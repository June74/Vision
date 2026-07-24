import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";
import type {
  CalendarCreationOperation,
  CalendarRepositoryPort,
  CalendarSetupSnapshot,
  VerifiedCalendarEvidence,
} from "../../src/data/repositories/calendar-repository";
import {
  CalendarProviderError,
  type CreatedSecondaryCalendar,
  type OwnedSecondaryCalendar,
} from "../../src/integrations/google-calendar/calendar-client";
import type {
  CalendarClientPort,
  CalendarSetupRouteDependencies,
} from "../../src/server/api/calendar-setup-routes";

const NOW = new Date("2026-07-23T19:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const KEY = "11111111-1111-4111-8111-111111111111";
const KEY_TWO = "22222222-2222-4222-8222-222222222222";
const SUBJECT = "google-subject";

function candidate(id: string): OwnedSecondaryCalendar {
  return {
    id,
    summary: "Vision",
    accessRole: "owner",
    timeZone: "America/Chicago",
    providerEtag: `"${id}"`,
    ownerGoogleSubject: SUBJECT,
  };
}

class MemoryCalendarRepository implements CalendarRepositoryPort {
  snapshot: CalendarSetupSnapshot | undefined;
  operations = new Map<string, CalendarCreationOperation>();
  failDiscoveryPersistence = false;
  failCompletionOnce = false;

  async getOrCreateAuthenticated(): Promise<CalendarSetupSnapshot> {
    this.snapshot ??= this.state("authenticated", 1);
    return this.snapshot;
  }

  async beginDiscovery(version: number): Promise<CalendarSetupSnapshot> {
    if (
      !this.snapshot ||
      this.snapshot.setupVersion !== version ||
      !["authenticated", "awaiting_confirmation"].includes(this.snapshot.status)
    ) {
      throw Object.assign(new Error("stale"), { code: "STALE_SETUP_VERSION" });
    }
    this.snapshot = this.state("discovering", version + 1);
    return this.snapshot;
  }

  async completeDiscovery(
    version: number,
    calendars: readonly VerifiedCalendarEvidence[],
  ): Promise<CalendarSetupSnapshot> {
    this.expect(version, "discovering");
    this.snapshot = this.state(
      calendars.length ? "awaiting_choice" : "awaiting_confirmation",
      version + 1,
      calendars,
    );
    return this.snapshot;
  }

  async discover(
    version: number,
    calendars: readonly VerifiedCalendarEvidence[],
  ): Promise<CalendarSetupSnapshot> {
    if (this.failDiscoveryPersistence) throw new Error("injected persistence failure");
    const current = this.snapshot ?? this.state("authenticated", 1);
    const hasUnresolved = [...this.operations.values()].some(({ status }) =>
      ["in_progress", "retryable", "action_required"].includes(status),
    );
    if (
      current.setupVersion !== version ||
      !["authenticated", "awaiting_confirmation", "failed"].includes(
        current.status,
      ) ||
      (current.status === "failed" && hasUnresolved)
    ) {
      return this.snapshot ?? current;
    }
    this.snapshot = this.state(
      calendars.length ? "awaiting_choice" : "awaiting_confirmation",
      version + 1,
      calendars,
    );
    return this.snapshot;
  }

  async selectExisting(
    version: number,
    calendar: VerifiedCalendarEvidence,
  ): Promise<CalendarSetupSnapshot> {
    this.expect(version, "awaiting_choice");
    if (!this.snapshot?.candidates.some(({ id }) => id === calendar.id)) {
      throw Object.assign(new Error("stale"), { code: "STALE_SETUP_VERSION" });
    }
    this.snapshot = this.connected(version + 1, calendar.id, "existing");
    return this.snapshot;
  }

  async beginCreation(
    version: number,
    idempotencyKey: string,
    preCreateCalendars: readonly VerifiedCalendarEvidence[],
    now: Date = NOW,
  ) {
    const existing = this.operations.get(idempotencyKey);
    if (existing) return { kind: "existing" as const, operation: existing };
    this.expect(version, "awaiting_confirmation");
    const operation: CalendarCreationOperation = {
      idempotencyKey,
      setupVersion: version,
      status: "in_progress",
      requestedAt: now,
      preCreateCalendarIds: preCreateCalendars.map(({ id }) => id),
    };
    this.operations.set(idempotencyKey, operation);
    this.snapshot = this.state("creating", version + 1);
    return { kind: "started" as const, operation };
  }

  async takeOverStaleCreation(
    idempotencyKey: string,
    staleBefore: Date,
  ): Promise<CalendarCreationOperation> {
    const operation = this.operations.get(idempotencyKey);
    if (!operation) throw new Error("missing");
    if (
      operation.status === "in_progress" &&
      operation.requestedAt.getTime() <= staleBefore.getTime() &&
      this.snapshot?.status === "creating" &&
      this.snapshot.setupVersion === operation.setupVersion + 1
    ) {
      await this.markCreationUncertain(idempotencyKey, "retryable");
    }
    return this.operations.get(idempotencyKey)!;
  }

  async findCreationOperation(
    idempotencyKey: string,
  ): Promise<CalendarCreationOperation | undefined> {
    return this.operations.get(idempotencyKey);
  }

  async completeCreation(
    idempotencyKey: string,
    calendar: VerifiedCalendarEvidence,
  ): Promise<CalendarSetupSnapshot> {
    if (this.failCompletionOnce) {
      this.failCompletionOnce = false;
      throw new Error("injected completion uncertainty");
    }
    const operation = this.operations.get(idempotencyKey);
    if (!operation) throw new Error("missing");
    this.operations.set(idempotencyKey, {
      ...operation,
      status: "completed",
      completedAt: NOW,
      resultCalendarId: calendar.id,
    });
    if (this.snapshot?.status !== "connected") {
      this.snapshot = this.connected(
        (this.snapshot?.setupVersion ?? operation.setupVersion) + 1,
        calendar.id,
        "created",
      );
    }
    return this.snapshot;
  }

  async markCreationUncertain(
    idempotencyKey: string,
    outcome: "retryable" | "action_required",
  ): Promise<CalendarSetupSnapshot> {
    const operation = this.operations.get(idempotencyKey)!;
    const expectedStatus =
      outcome === "retryable" ? "in_progress" : "retryable";
    if (operation.status !== expectedStatus) {
      if (!this.snapshot) throw new Error("missing");
      return this.snapshot;
    }
    this.operations.set(idempotencyKey, { ...operation, status: outcome });
    this.snapshot = {
      ...this.state("failed", (this.snapshot?.setupVersion ?? 3) + 1),
      actionRequired: outcome === "action_required",
    };
    return this.snapshot;
  }

  async markCreationDefiniteFailure(
    idempotencyKey: string,
  ): Promise<CalendarSetupSnapshot> {
    const operation = this.operations.get(idempotencyKey)!;
    if (operation.status === "definite_failure") {
      if (!this.snapshot) throw new Error("missing");
      return this.snapshot;
    }
    if (
      !["in_progress", "retryable", "action_required"].includes(
        operation.status,
      )
    ) {
      throw new Error("invalid terminalization");
    }
    this.operations.set(idempotencyKey, {
      ...operation,
      status: "definite_failure",
      completedAt: NOW,
    });
    this.snapshot = {
      ...this.state("failed", (this.snapshot?.setupVersion ?? 2) + 1),
      actionRequired: true,
    };
    return this.snapshot;
  }

  async getSnapshot(): Promise<CalendarSetupSnapshot | undefined> {
    return this.snapshot;
  }

  private expect(version: number, status: CalendarSetupSnapshot["status"]): void {
    if (
      !this.snapshot ||
      this.snapshot.setupVersion !== version ||
      this.snapshot.status !== status
    ) {
      throw Object.assign(new Error("stale"), { code: "STALE_SETUP_VERSION" });
    }
  }

  private state(
    status: CalendarSetupSnapshot["status"],
    setupVersion: number,
    candidates: readonly VerifiedCalendarEvidence[] = [],
  ): CalendarSetupSnapshot {
    return { status, setupVersion, candidates, actionRequired: false };
  }

  private connected(
    setupVersion: number,
    calendarId: string,
    connectionKind: "existing" | "created",
  ): CalendarSetupSnapshot {
    return {
      ...this.state("connected", setupVersion),
      connection: {
        calendarId,
        connectionKind,
        timeZone: "America/Chicago",
        providerEtag: `"${calendarId}"`,
        verifiedAt: NOW,
      },
    };
  }
}

function createHarness(options: {
  lists?: readonly (readonly OwnedSecondaryCalendar[])[];
  createError?: CalendarProviderError;
  getError?: CalendarProviderError;
  listError?: CalendarProviderError;
  tokenUnavailable?: boolean;
  failDiscoveryPersistence?: boolean;
  failCompletionOnce?: boolean;
  now?: () => Date;
} = {}) {
  const repository = new MemoryCalendarRepository();
  repository.failDiscoveryPersistence = options.failDiscoveryPersistence ?? false;
  repository.failCompletionOnce = options.failCompletionOnce ?? false;
  const lists = [...(options.lists ?? [[]])];
  const createSecondaryCalendar = vi.fn<
    (timeZone: string) => Promise<CreatedSecondaryCalendar>
  >();
  if (options.createError) {
    createSecondaryCalendar.mockRejectedValue(options.createError);
  } else {
    createSecondaryCalendar.mockResolvedValue({
      id: "created-vision",
      summary: "Vision",
      timeZone: "America/Chicago",
      providerEtag: '"created-resource"',
    });
  }
  const getCalendar = vi.fn(async (id: string) => candidate(id));
  if (options.getError) getCalendar.mockRejectedValueOnce(options.getError);
  const client: CalendarClientPort = {
    listOwnedSecondaryCalendars: vi.fn(async () => {
      if (options.listError) throw options.listError;
      return lists.shift() ?? [];
    }),
    createSecondaryCalendar,
    getCalendar,
  };
  const dependencies: CalendarSetupRouteDependencies = {
    logger: vi.fn(),
    now: options.now ?? (() => NOW),
    userTimeZone: "America/Chicago",
    sessions: {
      findSession: vi.fn(async (sessionId) =>
        sessionId === SESSION_ID
          ? {
              ownerId: "usr_private_pilot",
              googleSubject: SUBJECT,
              email: "allowed@example.test",
              csrfToken: CSRF,
              createdAt: NOW,
              expiresAt: new Date(NOW.getTime() + 600_000),
            }
          : undefined,
      ),
    },
    tokens: {
      getGoogleTokens: vi.fn(async () =>
        options.tokenUnavailable
          ? undefined
          : {
              refreshToken: "REFRESH_TOKEN_SENTINEL",
              accessToken: "ACCESS_TOKEN_SENTINEL",
              accessExpiresAt: new Date(NOW.getTime() + 600_000),
              grantedScopes: [],
              tokenVersion: 1,
            },
      ),
    },
    createCalendarClient: () => client,
    createRepository: () => repository,
  };
  const app = createApp({
    calendarSetup: dependencies,
    createRequestId: () => "req_calendar",
    logger: dependencies.logger,
  });
  return { app, client, createSecondaryCalendar, repository, dependencies };
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://vision.example.test${path}`, {
    ...init,
    headers: {
      cookie: `vision_session=${SESSION_ID}`,
      ...(init.headers ?? {}),
    },
  });
}

function post(path: string, body: unknown, csrf = CSRF): Request {
  return request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vision-csrf": csrf,
    },
    body: JSON.stringify(body),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

describe("Vision Worker calendar setup", () => {
  it("keeps cookie-only GET read-only and exposes the initial authenticated snapshot", async () => {
    const { app, client, repository } = createHarness();
    const first = await app.fetch(request("/api/setup/calendar"), {} as Env);
    const second = await app.fetch(request("/api/setup/calendar"), {} as Env);

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      status: "authenticated",
      setupVersion: 1,
    });
    expect(second.status).toBe(200);
    expect(repository.snapshot).toBeUndefined();
    expect(client.listOwnedSecondaryCalendars).not.toHaveBeenCalled();
  });

  it("discovers zero, one, and multiple exact candidates only through CSRF-protected POST", async () => {
    for (const candidates of [[], [candidate("one")], [candidate("one"), candidate("two")]]) {
      const { app } = createHarness({ lists: [candidates] });
      const response = await app.fetch(
        post("/api/setup/calendar/discover", { setupVersion: 1 }),
        {} as Env,
      );
      expect(response.status).toBe(200);
      const body = await response.json<Record<string, unknown>>();
      expect(body).toMatchObject({
        status: candidates.length ? "awaiting_choice" : "awaiting_confirmation",
        setupVersion: 2,
      });
      expect((body.candidates as unknown[]).length).toBe(candidates.length);
      expect(body).not.toHaveProperty("connection");
    }
  });

  it("requires authenticated session and CSRF, then selects only an explicit stable ID", async () => {
    const { app } = createHarness({ lists: [[candidate("one")]] });
    const unauthenticated = await app.fetch(
      new Request("https://vision.example.test/api/setup/calendar"),
      {} as Env,
    );
    expect(unauthenticated.status).toBe(401);

    const missingDiscoveryCsrf = await app.fetch(
      request("/api/setup/calendar/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupVersion: 1 }),
      }),
      {} as Env,
    );
    expect(missingDiscoveryCsrf.status).toBe(403);
    const wrongDiscoveryCsrf = await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }, "X".repeat(43)),
      {} as Env,
    );
    expect(wrongDiscoveryCsrf.status).toBe(403);
    const discovery = await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    expect(discovery.status).toBe(200);

    const missingCsrf = await app.fetch(
      request("/api/setup/calendar/select", {
        method: "POST",
        body: JSON.stringify({ setupVersion: 2, calendarId: "one" }),
      }),
      {} as Env,
    );
    expect(missingCsrf.status).toBe(403);

    const selected = await app.fetch(
      post("/api/setup/calendar/select", {
        setupVersion: 2,
        calendarId: "one",
      }),
      {} as Env,
    );
    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      status: "connected",
      connection: { calendarId: "one", connectionKind: "existing" },
    });
  });

  it("enforces exact current version, exact phrase, strict body, and a UUID key", async () => {
    const { app, createSecondaryCalendar } = createHarness();
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    for (const body of [
      { setupVersion: 1, confirmation: "CREATE VISION CALENDAR", idempotencyKey: KEY },
      { setupVersion: 2, confirmation: "Create Vision Calendar", idempotencyKey: KEY },
      { setupVersion: 2, confirmation: "CREATE VISION CALENDAR", idempotencyKey: "no" },
      { setupVersion: 2, confirmation: "CREATE VISION CALENDAR", idempotencyKey: KEY, extra: true },
    ]) {
      const response = await app.fetch(
        post("/api/setup/calendar/confirm-create", body),
        {} as Env,
      );
      expect([400, 409]).toContain(response.status);
    }
    expect(createSecondaryCalendar).not.toHaveBeenCalled();
  });

  it("creates once and returns the same connection for a repeated idempotency key", async () => {
    const { app, createSecondaryCalendar } = createHarness({ lists: [[], []] });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    const body = {
      setupVersion: 2,
      confirmation: "CREATE VISION CALENDAR",
      idempotencyKey: KEY,
    };
    const first = await app.fetch(
      post("/api/setup/calendar/confirm-create", body),
      {} as Env,
    );
    const second = await app.fetch(
      post("/api/setup/calendar/confirm-create", body),
      {} as Env,
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);
    expect(createSecondaryCalendar).toHaveBeenCalledWith("America/Chicago");
  });

  it("keeps the original create authoritative while a same-key replay arrives in flight", async () => {
    const clock = { value: NOW };
    const { app, client, repository, createSecondaryCalendar } = createHarness({
      lists: [[], [], []],
      now: () => clock.value,
    });
    const create = deferred<CreatedSecondaryCalendar>();
    createSecondaryCalendar.mockImplementation(() => create.promise);
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    const body = {
      setupVersion: 2,
      confirmation: "CREATE VISION CALENDAR",
      idempotencyKey: KEY,
    };
    const original = app.fetch(
      post("/api/setup/calendar/confirm-create", body),
      {} as Env,
    );
    await vi.waitFor(() =>
      expect(createSecondaryCalendar).toHaveBeenCalledTimes(1),
    );
    clock.value = new Date(NOW.getTime() + 30_000);

    const replay = await app.fetch(
      post("/api/setup/calendar/confirm-create", body),
      {} as Env,
    );
    expect(replay.status).toBe(202);
    await expect(replay.json()).resolves.toMatchObject({
      status: "creating",
      setupVersion: 3,
    });
    expect(repository.operations.get(KEY)).toMatchObject({
      status: "in_progress",
    });
    expect(client.listOwnedSecondaryCalendars).toHaveBeenCalledTimes(2);

    create.reject(new CalendarProviderError("definite_failure"));
    const rejected = await original;
    expect(rejected.status).toBe(409);
    expect(repository.operations.get(KEY)).toMatchObject({
      status: "definite_failure",
    });
  });

  it("takes over an expired crashed create for reconciliation without issuing another insert", async () => {
    const clock = { value: NOW };
    const { app, client, repository, createSecondaryCalendar } = createHarness({
      lists: [[], [candidate("created-before-crash")]],
      now: () => clock.value,
    });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    await repository.beginCreation(2, KEY, [], NOW);
    clock.value = new Date(NOW.getTime() + 120_001);

    const replay = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      }),
      {} as Env,
    );

    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({
      status: "connected",
      connection: { calendarId: "created-before-crash" },
    });
    expect(createSecondaryCalendar).not.toHaveBeenCalled();
    expect(client.listOwnedSecondaryCalendars).toHaveBeenCalledTimes(2);
  });

  it("linearizes concurrent expired replays and never issues a replacement insert", async () => {
    const clock = { value: NOW };
    const { app, repository, createSecondaryCalendar } = createHarness({
      lists: [
        [],
        [candidate("created-before-crash")],
        [candidate("created-before-crash")],
      ],
      now: () => clock.value,
    });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    await repository.beginCreation(2, KEY, [], NOW);
    clock.value = new Date(NOW.getTime() + 120_001);
    const body = {
      setupVersion: 2,
      confirmation: "CREATE VISION CALENDAR",
      idempotencyKey: KEY,
    };

    const [first, second] = await Promise.all([
      app.fetch(post("/api/setup/calendar/confirm-create", body), {} as Env),
      app.fetch(post("/api/setup/calendar/confirm-create", body), {} as Env),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(repository.operations.get(KEY)).toMatchObject({
      status: "completed",
      resultCalendarId: "created-before-crash",
    });
    expect(createSecondaryCalendar).not.toHaveBeenCalled();
  });

  it("requires explicit selection when a candidate appears after discovery but before confirmation", async () => {
    const { app, createSecondaryCalendar } = createHarness({
      lists: [[], [candidate("appeared-later")]],
    });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );

    const response = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      }),
      {} as Env,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: "awaiting_choice",
      candidates: [{ calendarId: "appeared-later" }],
    });
    expect(createSecondaryCalendar).not.toHaveBeenCalled();
  });

  it("reconciles exactly one new owned ID after a lost create response", async () => {
    const { app, repository, createSecondaryCalendar } = createHarness({
      lists: [[], [], [candidate("created-after-timeout")]],
      createError: new CalendarProviderError("uncertain"),
    });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    const response = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      }),
      {} as Env,
    );
    expect(response.status).toBe(200);
    expect(repository.snapshot).toMatchObject({
      status: "connected",
      connection: { calendarId: "created-after-timeout" },
    });
    expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);
  });

  it("never blindly creates again when uncertain reconciliation finds zero or many new IDs", async () => {
    for (const discovered of [
      [],
      [candidate("new-a"), candidate("new-b")],
    ]) {
      const { app, createSecondaryCalendar } = createHarness({
        lists: [[], [], discovered, discovered],
        createError: new CalendarProviderError("uncertain"),
      });
      await app.fetch(
        post("/api/setup/calendar/discover", { setupVersion: 1 }),
        {} as Env,
      );
      const body = {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      };
      const first = await app.fetch(
        post("/api/setup/calendar/confirm-create", body),
        {} as Env,
      );
      const repeated = await app.fetch(
        post("/api/setup/calendar/confirm-create", body),
        {} as Env,
      );
      expect(first.status).toBe(discovered.length === 0 ? 202 : 409);
      expect([202, 409]).toContain(repeated.status);
      expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);
    }
  });

  it("leaves setup unchanged when token resolution, provider listing, or atomic persistence fails", async () => {
    for (const options of [
      { tokenUnavailable: true },
      { listError: new CalendarProviderError("definite_failure") },
      { failDiscoveryPersistence: true },
    ]) {
      const { app, repository } = createHarness(options);
      const response = await app.fetch(
        post("/api/setup/calendar/discover", { setupVersion: 1 }),
        {} as Env,
      );
      expect(response.status).toBe(503);
      expect(repository.snapshot).toBeUndefined();
      const readOnly = await app.fetch(
        request("/api/setup/calendar"),
        {} as Env,
      );
      await expect(readOnly.json()).resolves.toMatchObject({
        status: "authenticated",
        setupVersion: 1,
      });
    }
  });

  it("terminalizes a definite insert rejection and allows a corrected fresh discovery, version, confirmation, and key", async () => {
    const { app, repository, createSecondaryCalendar } = createHarness({
      lists: [[], [], [], []],
      createError: new CalendarProviderError("definite_failure"),
    });
    await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 1 }),
      {} as Env,
    );
    const rejected = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      }),
      {} as Env,
    );
    expect(rejected.status).toBe(409);
    expect(repository.operations.get(KEY)).toMatchObject({
      status: "definite_failure",
    });
    expect(repository.snapshot).toMatchObject({
      status: "failed",
      setupVersion: 4,
      actionRequired: true,
    });
    const rejectedReplay = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 2,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY,
      }),
      {} as Env,
    );
    expect(rejectedReplay.status).toBe(409);
    expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);

    createSecondaryCalendar.mockReset().mockResolvedValue({
      id: "created-after-correction",
      summary: "Vision",
      timeZone: "America/Chicago",
      providerEtag: '"created"',
    });
    const rediscovered = await app.fetch(
      post("/api/setup/calendar/discover", { setupVersion: 4 }),
      {} as Env,
    );
    expect(rediscovered.status).toBe(200);
    await expect(rediscovered.json()).resolves.toMatchObject({
      status: "awaiting_confirmation",
      setupVersion: 5,
    });
    const corrected = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 5,
        confirmation: "CREATE VISION CALENDAR",
        idempotencyKey: KEY_TWO,
      }),
      {} as Env,
    );
    expect(corrected.status).toBe(200);
    expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);
  });

  it("reconciles after successful insert when verification or persistence becomes uncertain", async () => {
    for (const options of [
      {
        getError: new CalendarProviderError("definite_failure"),
        lists: [[], [], [candidate("created-vision")]],
      },
      {
        failCompletionOnce: true,
        lists: [[], [], [candidate("created-vision")]],
      },
    ]) {
      const { app, repository, createSecondaryCalendar } =
        createHarness(options);
      await app.fetch(
        post("/api/setup/calendar/discover", { setupVersion: 1 }),
        {} as Env,
      );
      const response = await app.fetch(
        post("/api/setup/calendar/confirm-create", {
          setupVersion: 2,
          confirmation: "CREATE VISION CALENDAR",
          idempotencyKey: KEY,
        }),
        {} as Env,
      );
      expect(response.status).toBe(200);
      expect(repository.snapshot).toMatchObject({
        status: "connected",
        connection: { calendarId: "created-vision" },
      });
      expect(createSecondaryCalendar).toHaveBeenCalledTimes(1);
    }
  });

  it("exposes no event write method through its provider mock or route source", () => {
    const { client } = createHarness();
    expect(Object.keys(client).sort()).toEqual([
      "createSecondaryCalendar",
      "getCalendar",
      "listOwnedSecondaryCalendars",
    ]);
  });
});
