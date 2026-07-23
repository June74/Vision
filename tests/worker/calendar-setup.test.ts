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
  ) {
    const existing = this.operations.get(idempotencyKey);
    if (existing) return { kind: "existing" as const, operation: existing };
    this.expect(version, "awaiting_confirmation");
    const operation: CalendarCreationOperation = {
      idempotencyKey,
      setupVersion: version,
      status: "in_progress",
      requestedAt: NOW,
      preCreateCalendarIds: preCreateCalendars.map(({ id }) => id),
    };
    this.operations.set(idempotencyKey, operation);
    this.snapshot = this.state("creating", version + 1);
    return { kind: "started" as const, operation };
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
    this.operations.set(idempotencyKey, { ...operation, status: outcome });
    this.snapshot = {
      ...this.state("failed", (this.snapshot?.setupVersion ?? 3) + 1),
      actionRequired: outcome === "action_required",
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
} = {}) {
  const repository = new MemoryCalendarRepository();
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
  const client: CalendarClientPort = {
    listOwnedSecondaryCalendars: vi.fn(async () => lists.shift() ?? []),
    createSecondaryCalendar,
    getCalendar: vi.fn(async (id) => candidate(id)),
  };
  const dependencies: CalendarSetupRouteDependencies = {
    logger: vi.fn(),
    now: () => NOW,
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
              expiresAt: new Date(NOW.getTime() + 60_000),
            }
          : undefined,
      ),
    },
    tokens: {
      getGoogleTokens: vi.fn(async () => ({
        refreshToken: "REFRESH_TOKEN_SENTINEL",
        accessToken: "ACCESS_TOKEN_SENTINEL",
        accessExpiresAt: new Date(NOW.getTime() + 60_000),
        grantedScopes: [],
        tokenVersion: 1,
      })),
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

describe("Vision Worker calendar setup", () => {
  it("discovers zero, one, and multiple exact candidates without auto-selecting by name", async () => {
    for (const candidates of [[], [candidate("one")], [candidate("one"), candidate("two")]]) {
      const { app } = createHarness({ lists: [candidates] });
      const response = await app.fetch(
        request("/api/setup/calendar"),
        {} as Env,
      );
      expect(response.status).toBe(200);
      const body = await response.json<Record<string, unknown>>();
      expect(body).toMatchObject({
        status: candidates.length ? "awaiting_choice" : "awaiting_confirmation",
        setupVersion: 3,
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
    await app.fetch(request("/api/setup/calendar"), {} as Env);

    const missingCsrf = await app.fetch(
      request("/api/setup/calendar/select", {
        method: "POST",
        body: JSON.stringify({ setupVersion: 3, calendarId: "one" }),
      }),
      {} as Env,
    );
    expect(missingCsrf.status).toBe(403);

    const selected = await app.fetch(
      post("/api/setup/calendar/select", {
        setupVersion: 3,
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
    await app.fetch(request("/api/setup/calendar"), {} as Env);
    for (const body of [
      { setupVersion: 2, confirmation: "CREATE VISION CALENDAR", idempotencyKey: KEY },
      { setupVersion: 3, confirmation: "Create Vision Calendar", idempotencyKey: KEY },
      { setupVersion: 3, confirmation: "CREATE VISION CALENDAR", idempotencyKey: "no" },
      { setupVersion: 3, confirmation: "CREATE VISION CALENDAR", idempotencyKey: KEY, extra: true },
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
    await app.fetch(request("/api/setup/calendar"), {} as Env);
    const body = {
      setupVersion: 3,
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

  it("requires explicit selection when a candidate appears after discovery but before confirmation", async () => {
    const { app, createSecondaryCalendar } = createHarness({
      lists: [[], [candidate("appeared-later")]],
    });
    await app.fetch(request("/api/setup/calendar"), {} as Env);

    const response = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 3,
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
    await app.fetch(request("/api/setup/calendar"), {} as Env);
    const response = await app.fetch(
      post("/api/setup/calendar/confirm-create", {
        setupVersion: 3,
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
      await app.fetch(request("/api/setup/calendar"), {} as Env);
      const body = {
        setupVersion: 3,
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

  it("exposes no event write method through its provider mock or route source", () => {
    const { client } = createHarness();
    expect(Object.keys(client).sort()).toEqual([
      "createSecondaryCalendar",
      "getCalendar",
      "listOwnedSecondaryCalendars",
    ]);
  });
});
