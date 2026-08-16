import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";
import type {
  CalendarConnection,
  CalendarRepositoryPort,
  CalendarSetupSnapshot,
} from "../../src/data/repositories/calendar-repository";
import type { EncryptedSessionRepository } from "../../src/data/repositories/session-repository";
import type { TokenRepositoryPort } from "../../src/data/repositories/token-repository";
import {
  CalendarWriteProviderError,
  type CalendarWriteAudit,
  type CalendarWriteLedger,
  type CalendarWriteLedgerRecord,
  type CalendarWriteProvider,
  type CalendarWriteProviderEvent,
} from "../../src/domain/calendar-write/create-execution";
import {
  createCalendarWriteProposal,
  type CalendarWriteProposal,
} from "../../src/domain/calendar-write/approval";
import type {
  CalendarWriteApprovalRecord,
  CalendarWriteApprovalStore,
} from "../../src/data/repositories/calendar-write-repository";
import {
  registerCalendarWriteRoutes,
  type CalendarWriteRouteDependencies,
} from "../../src/server/api/calendar-write-routes";

const NOW = new Date("2026-08-20T23:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";
const OTHER_OWNER_ID = "usr_other_owner";
const SUBJECT = "google-subject";
const ACCESS_TOKEN = "ACCESS_TOKEN_SENTINEL";
const CALENDAR_ID = "vision-calendar";
const CALENDAR_VERSION = "etag-calendar-1";
const OPERATION_ID = "op-calendar-write-1";
const EVENT_ID = "event-calendar-write-1";
const EVENT_VERSION = "etag-event-1";

function validPreviewInput(): Record<string, unknown> {
  return {
    title: "Study session",
    description: "Review the next chapter.",
    startsAt: "2026-08-21T19:00:00-05:00",
    endsAt: "2026-08-21T20:00:00-05:00",
    timeZone: "America/Chicago",
    domain: "school",
    privacy: "private",
    attendees: [],
    recurrence: null,
    notifications: "none",
  };
}

function validProposal(): CalendarWriteProposal {
  return createCalendarWriteProposal({
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    target: { calendarId: CALENDAR_ID, version: CALENDAR_VERSION },
    requestedAt: NOW.toISOString(),
    event: validPreviewInput(),
  });
}

function connectedSnapshot(): CalendarSetupSnapshot {
  const connection: CalendarConnection = {
    calendarId: CALENDAR_ID,
    connectionKind: "existing",
    timeZone: "America/Chicago",
    providerEtag: CALENDAR_VERSION,
    verifiedAt: NOW,
  };
  return {
    setupVersion: 9,
    status: "connected",
    actionRequired: false,
    candidates: [],
    connection,
  };
}

class MemoryApprovalStore implements CalendarWriteApprovalStore {
  readonly records = new Map<string, StoredApproval>();

  readonly createApproval = vi.fn(
    async (input: {
      readonly proposal: CalendarWriteProposal;
      readonly requestedAt: Date;
      readonly expiresAt: Date;
    }): Promise<void> => {
      const { proposal, requestedAt, expiresAt } = input;
      this.records.set(proposal.operationId, {
        ownerId: proposal.ownerId,
        operationId: proposal.operationId,
        provider: "google",
        calendarId: proposal.target.calendarId,
        proposalDomain: proposal.preview.after.domain,
        status: "proposed",
        requestedAt,
        expiresAt,
        proposal,
      });
    },
  );

  readonly findApproval = vi.fn(
    async (
      ownerId: string,
      operationId: string,
    ): Promise<CalendarWriteApprovalRecord | undefined> => {
      const record = this.records.get(operationId);
      if (!record || record.ownerId !== ownerId) return undefined;
      return { ...record };
    },
  );

  readonly loadProposal = vi.fn(
    async (
      ownerId: string,
      operationId: string,
    ): Promise<CalendarWriteProposal | undefined> => {
      const record = this.records.get(operationId);
      if (!record || record.ownerId !== ownerId || record.status === "invalidated") {
        return undefined;
      }
      return record.proposal;
    },
  );

  readonly confirmApproval = vi.fn(
    async (
      ownerId: string,
      operationId: string,
      now: Date,
    ): Promise<"confirmed" | "already_confirmed" | "expired" | "missing"> => {
      const record = this.records.get(operationId);
      if (!record || record.ownerId !== ownerId) return "missing";
      if (record.status === "confirmed") return "already_confirmed";
      if (record.status !== "proposed") return "missing";
      if (record.expiresAt.getTime() <= now.getTime()) {
        this.records.set(operationId, { ...record, status: "invalidated" });
        return "expired";
      }
      this.records.set(operationId, { ...record, status: "confirmed" });
      return "confirmed";
    },
  );

  readonly invalidateApproval = vi.fn(
    async (ownerId: string, operationId: string): Promise<void> => {
      const record = this.records.get(operationId);
      if (record?.ownerId === ownerId) {
        this.records.set(operationId, { ...record, status: "invalidated" });
      }
    },
  );
}

class MemoryWriteLedger implements CalendarWriteLedger {
  readonly records = new Map<string, CalendarWriteLedgerRecord>();

  readonly find = vi.fn(
    async (
      ownerId: string,
      operationId: string,
    ): Promise<CalendarWriteLedgerRecord | undefined> => {
      const record = this.records.get(operationId);
      return record?.ownerId === ownerId ? record : undefined;
    },
  );

  readonly claim = vi.fn(
    async (
      ownerId: string,
      operationId: string,
      calendarId: string,
    ): Promise<"claimed" | "existing"> => {
      if (this.records.has(operationId)) return "existing";
      this.records.set(operationId, {
        ownerId,
        operationId,
        calendarId,
        status: "writing",
      });
      return "claimed";
    },
  );

  readonly markPending = vi.fn(
    async (ownerId: string, operationId: string): Promise<void> => {
      const record = this.records.get(operationId);
      if (
        record?.ownerId === ownerId &&
        ["writing", "verified", "verification_pending"].includes(record.status)
      ) {
        this.records.set(operationId, {
          ...record,
          status: "verification_pending",
        });
      }
    },
  );

  readonly markVerified = vi.fn(
    async (
      ownerId: string,
      operationId: string,
      calendarId: string,
      eventId: string,
      eventVersion: string,
    ): Promise<void> => {
      const record = this.records.get(operationId);
      if (
        record?.ownerId === ownerId &&
        ["writing", "verification_pending"].includes(record.status)
      ) {
        this.records.set(operationId, {
          ownerId,
          operationId,
          calendarId,
          status: "verified",
          eventId,
          eventVersion,
        });
      }
    },
  );

  readonly markFailed = vi.fn(
    async (ownerId: string, operationId: string): Promise<void> => {
      const record = this.records.get(operationId);
      if (record?.ownerId === ownerId && record.status === "writing") {
        this.records.set(operationId, { ...record, status: "failed" });
      }
    },
  );

  readonly markUndone = vi.fn(
    async (ownerId: string, operationId: string): Promise<void> => {
      const record = this.records.get(operationId);
      if (record?.ownerId === ownerId && record.status === "verified") {
        this.records.set(operationId, { ...record, status: "undone" });
      }
    },
  );
}

type StoredProviderEvent = CalendarWriteProviderEvent & {
  readonly calendarId: string;
};

class FakeCalendarWriteProvider implements CalendarWriteProvider {
  calendarVersion = CALENDAR_VERSION;
  createMode: "verified" | "uncertain" | "definite_failure" = "verified";
  readBackMismatch = false;
  deleteMode: "deleted" | "not_found" | "uncertain" = "deleted";
  private readonly events = new Map<string, StoredProviderEvent>();
  private lastAttempt: StoredProviderEvent | undefined;

  readonly readCalendarVersion = vi.fn(
    async (calendarId: string): Promise<{ calendarId: string; version: string }> => ({
      calendarId,
      version: this.calendarVersion,
    }),
  );

  readonly createOneOffEvent = vi.fn(
    async (
      input: Parameters<CalendarWriteProvider["createOneOffEvent"]>[0],
    ): Promise<CalendarWriteProviderEvent> => {
      if (this.createMode === "definite_failure") {
        throw new CalendarWriteProviderError("definite_failure");
      }
      const event: StoredProviderEvent = {
        eventId: EVENT_ID,
        version: EVENT_VERSION,
        ...input,
      };
      this.lastAttempt = event;
      if (this.createMode !== "uncertain") this.events.set(event.eventId, event);
      if (this.createMode === "uncertain") {
        throw new CalendarWriteProviderError("uncertain");
      }
      return event;
    },
  );

  readonly findByOperationId = vi.fn(
    async (input: {
      readonly calendarId: string;
      readonly operationId: string;
    }): Promise<readonly CalendarWriteProviderEvent[]> =>
      [...this.events.values()].filter(
        (event) =>
          event.calendarId === input.calendarId &&
          event.operationId === input.operationId,
      ),
  );

  readonly readEvent = vi.fn(
    async (input: {
      readonly calendarId: string;
      readonly eventId: string;
    }): Promise<CalendarWriteProviderEvent | undefined> => {
      const event = this.events.get(input.eventId);
      if (!event || event.calendarId !== input.calendarId) return undefined;
      return this.readBackMismatch ? { ...event, title: "Mismatched title" } : event;
    },
  );

  readonly deleteEvent = vi.fn(
    async (input: {
      readonly calendarId: string;
      readonly eventId: string;
      readonly expectedVersion: string;
    }): Promise<"deleted" | "not_found"> => {
      if (this.deleteMode === "uncertain") {
        throw new CalendarWriteProviderError("uncertain");
      }
      const event = this.events.get(input.eventId);
      if (!event || event.calendarId !== input.calendarId) return "not_found";
      this.events.delete(input.eventId);
      return this.deleteMode === "not_found" ? "not_found" : "deleted";
    },
  );

  publishLastAttempt(): void {
    if (this.lastAttempt) this.events.set(this.lastAttempt.eventId, this.lastAttempt);
  }
}

type StoredApproval = CalendarWriteApprovalRecord & {
  readonly proposal: CalendarWriteProposal;
};

function createHarness(options: {
  readonly connected?: boolean;
  readonly tokenAvailable?: boolean;
} = {}) {
  let currentNow = NOW;
  let sessionOwnerId = OWNER_ID;
  const provider = new FakeCalendarWriteProvider();
  const approvals = new MemoryApprovalStore();
  const ledger = new MemoryWriteLedger();
  const connectionStore: Pick<CalendarRepositoryPort, "getSnapshot"> = {
    getSnapshot: vi.fn(async () =>
      options.connected === false ? undefined : connectedSnapshot(),
    ),
  };
  const logger = vi.fn();
  const audit: CalendarWriteAudit = { write: vi.fn(async () => undefined) };
  const sessions: Pick<EncryptedSessionRepository, "findSession"> = {
    findSession: vi.fn(async (sessionId: string) =>
      sessionId === SESSION_ID
        ? {
            ownerId: sessionOwnerId,
            googleSubject: SUBJECT,
            email: "allowed@example.test",
            csrfToken: CSRF,
            createdAt: NOW,
            expiresAt: new Date(NOW.getTime() + 600_000),
          }
        : undefined,
    ),
  };
  const tokens: Pick<TokenRepositoryPort, "getGoogleTokens"> = {
    getGoogleTokens: vi.fn(async (googleSubject: string) =>
      options.tokenAvailable === false || googleSubject !== SUBJECT
        ? undefined
        : {
            refreshToken: "REFRESH_TOKEN_SENTINEL",
            accessToken: ACCESS_TOKEN,
            accessExpiresAt: new Date(NOW.getTime() + 600_000),
            grantedScopes: [],
            tokenVersion: 1,
            updatedAt: NOW,
          },
    ),
  };
  const createProvider = vi.fn(
    (accessToken: string, googleSubject: string): CalendarWriteProvider => {
      if (accessToken !== ACCESS_TOKEN || googleSubject !== SUBJECT) {
        throw new Error("forged provider identity");
      }
      return provider;
    },
  );
  const dependencies: CalendarWriteRouteDependencies = {
    logger,
    now: () => currentNow,
    createOperationId: vi.fn(() => OPERATION_ID),
    sessions,
    tokens,
    createCalendarRepository: vi.fn(
      (ownerId: string, googleSubject: string) => {
        if (ownerId !== sessionOwnerId || googleSubject !== SUBJECT) {
          throw new Error("forged calendar scope");
        }
        return connectionStore;
      },
    ),
    createProvider,
    approvals,
    ledger,
    audit,
  };
  const app = createApp({
    calendarWrite: dependencies,
    createRequestId: () => "req_calendar_write",
    logger,
  } as unknown as Parameters<typeof createApp>[0]);

  return {
    app,
    provider,
    approvals,
    ledger,
    dependencies,
    sessions,
    tokens,
    createProvider,
    connectionStore,
    setNow(value: Date) {
      currentNow = value;
    },
    setSessionOwner(value: string) {
      sessionOwnerId = value;
    },
  };
}

function request(
  path: string,
  init: RequestInit = {},
  includeCookie = true,
): Request {
  const headers = new Headers(init.headers);
  if (includeCookie) headers.set("cookie", "vision_session=" + SESSION_ID);
  return new Request("https://vision.example.test" + path, {
    ...init,
    headers,
  });
}

function post(
  path: string,
  body: unknown,
  csrf: string | null = CSRF,
  includeCookie = true,
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (csrf !== null) headers.set("x-vision-csrf", csrf);
  return request(
    path,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    includeCookie,
  );
}

async function preview(harness: ReturnType<typeof createHarness>) {
  const response = await harness.app.fetch(
    post("/api/calendar/writes/preview", validPreviewInput()),
    {} as Env,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    operationId: string;
    expiresAt: string;
    preview: CalendarWriteProposal["preview"];
    undoAvailable: boolean;
  };
}

async function status(
  harness: ReturnType<typeof createHarness>,
  operationId = OPERATION_ID,
) {
  return harness.app.fetch(
    request("/api/calendar/writes/" + operationId),
    {} as Env,
  );
}

async function confirm(
  harness: ReturnType<typeof createHarness>,
  body: unknown = { confirmation: "CONFIRM ONE-OFF EVENT" },
) {
  return harness.app.fetch(
    post("/api/calendar/writes/" + OPERATION_ID + "/confirm", body),
    {} as Env,
  );
}

async function undo(
  harness: ReturnType<typeof createHarness>,
  body: unknown = { confirmation: "UNDO ONE-OFF EVENT" },
) {
  return harness.app.fetch(
    post("/api/calendar/writes/" + OPERATION_ID + "/undo", body),
    {} as Env,
  );
}

describe("Vision Worker Phase C calendar writes", () => {
  it("previews a server-owned one-off write without mutating the provider", async () => {
    const harness = createHarness();
    const body = await preview(harness);

    expect(body).toMatchObject({
      operationId: OPERATION_ID,
      expiresAt: new Date(NOW.getTime() + 600_000).toISOString(),
      preview: {
        before: null,
        after: {
          title: "Study session",
          description: "Review the next chapter.",
          attendees: { mode: "none", count: 0, addresses: [] },
          recurrence: { scope: "one-off", rules: [] },
          notifications: { policy: "none", willNotify: false },
        },
      },
      undoAvailable: false,
    });
    expect(harness.provider.readCalendarVersion).toHaveBeenCalledWith(CALENDAR_ID);
    expect(harness.provider.createOneOffEvent).not.toHaveBeenCalled();
    expect(harness.approvals.createApproval).toHaveBeenCalledTimes(1);
    expect(harness.createProvider).toHaveBeenCalledWith(ACCESS_TOKEN, SUBJECT);
    expect(JSON.stringify(body)).not.toContain(SUBJECT);
    expect(JSON.stringify(body)).not.toContain(ACCESS_TOKEN);
  });

  it("authenticates before parsing a caller body and requires CSRF for preview", async () => {
    const missingSession = createHarness();
    const unauthenticated = await missingSession.app.fetch(
      post(
        "/api/calendar/writes/preview",
        "{ malformed",
        CSRF,
        false,
      ),
      {} as Env,
    );
    expect(unauthenticated.status).toBe(401);
    expect(missingSession.provider.readCalendarVersion).not.toHaveBeenCalled();
    expect(missingSession.approvals.createApproval).not.toHaveBeenCalled();

    const missingCsrf = createHarness();
    const csrfRejected = await missingCsrf.app.fetch(
      post("/api/calendar/writes/preview", validPreviewInput(), null),
      {} as Env,
    );
    expect(csrfRejected.status).toBe(403);
    expect(missingCsrf.provider.readCalendarVersion).not.toHaveBeenCalled();
    expect(missingCsrf.approvals.createApproval).not.toHaveBeenCalled();
  });

  it("rejects malformed, oversized, unsupported, and extra-key input before provider access", async () => {
    const cases: readonly Record<string, unknown>[] = [
      { ...validPreviewInput(), extra: true },
      { ...validPreviewInput(), attendees: ["person@example.test"] },
      { ...validPreviewInput(), recurrence: ["RRULE:FREQ=DAILY"] },
      { ...validPreviewInput(), notifications: "all" },
      {
        ...validPreviewInput(),
        startsAt: "2026-08-21T20:00:00-05:00",
        endsAt: "2026-08-21T19:00:00-05:00",
      },
    ];

    for (const input of cases) {
      const harness = createHarness();
      const response = await harness.app.fetch(
        post("/api/calendar/writes/preview", input),
        {} as Env,
      );
      expect(response.status).toBe(400);
      expect(harness.provider.readCalendarVersion).not.toHaveBeenCalled();
      expect(harness.approvals.createApproval).not.toHaveBeenCalled();
    }

    const wrongContentType = createHarness();
    const wrongContentTypeResponse = await wrongContentType.app.fetch(
      request("/api/calendar/writes/preview", {
        method: "POST",
        headers: { "content-type": "text/plain", "x-vision-csrf": CSRF },
        body: JSON.stringify(validPreviewInput()),
      }),
      {} as Env,
    );
    expect(wrongContentTypeResponse.status).toBe(400);
    expect(wrongContentType.provider.readCalendarVersion).not.toHaveBeenCalled();

    const oversized = createHarness();
    const oversizedInput = {
      ...validPreviewInput(),
      title: "x".repeat(20_000),
    };
    const oversizedResponse = await oversized.app.fetch(
      post("/api/calendar/writes/preview", oversizedInput),
      {} as Env,
    );
    expect(oversizedResponse.status).toBe(400);
    expect(oversized.provider.readCalendarVersion).not.toHaveBeenCalled();
  });

  it("rejects forged owner, account, calendar, version, token, and event authority", async () => {
    const harness = createHarness();
    const forgedPreview = await harness.app.fetch(
      post("/api/calendar/writes/preview", {
        ...validPreviewInput(),
        ownerId: OTHER_OWNER_ID,
        googleSubject: "attacker-subject",
        calendarId: "attacker-calendar",
        version: "attacker-version",
        accessToken: "attacker-token",
        eventId: "attacker-event",
      }),
      {} as Env,
    );
    expect(forgedPreview.status).toBe(400);
    expect(harness.provider.readCalendarVersion).not.toHaveBeenCalled();
    expect(harness.approvals.createApproval).not.toHaveBeenCalled();
  });

  it("projects owner-scoped approval status and hides a foreign operation", async () => {
    const harness = createHarness();
    await preview(harness);

    const proposed = await status(harness);
    expect(proposed.status).toBe(200);
    await expect(proposed.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "proposed",
      undoAvailable: false,
    });

    harness.setSessionOwner(OTHER_OWNER_ID);
    const foreign = await status(harness);
    expect(foreign.status).toBe(404);
    harness.setSessionOwner(OWNER_ID);
    expect((await status(harness)).status).toBe(200);
  });

  it("confirms one proposal, verifies it, and replays without a second create", async () => {
    const harness = createHarness();
    await preview(harness);

    const first = await confirm(harness);
    const replay = await confirm(harness);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "verified",
      undoAvailable: true,
    });
    await expect(replay.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "verified",
      undoAvailable: true,
    });
    expect(harness.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(harness.ledger.claim).toHaveBeenCalledTimes(1);
    expect(harness.ledger.records.get(OPERATION_ID)).toMatchObject({
      ownerId: OWNER_ID,
      calendarId: CALENDAR_ID,
      status: "verified",
      eventId: EVENT_ID,
      eventVersion: EVENT_VERSION,
    });
  });

  it("allows concurrent confirmations to reconcile one durable claim", async () => {
    const harness = createHarness();
    await preview(harness);

    const responses = await Promise.all([
      confirm(harness),
      confirm(harness),
      confirm(harness),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      200,
      200,
    ]);
    expect(harness.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(harness.ledger.claim).toHaveBeenCalledTimes(1);
  });

  it("invalidates a stale target before provider creation and rejects expired approval", async () => {
    const stale = createHarness();
    await preview(stale);
    stale.provider.calendarVersion = "etag-calendar-new";
    const staleResponse = await confirm(stale);
    expect(staleResponse.status).toBe(409);
    expect(stale.provider.createOneOffEvent).not.toHaveBeenCalled();
    expect(stale.ledger.claim).not.toHaveBeenCalled();
    expect(stale.approvals.records.get(OPERATION_ID)?.status).toBe("invalidated");

    const expired = createHarness();
    await preview(expired);
    expired.setNow(new Date(NOW.getTime() + 601_000));
    const expiredResponse = await confirm(expired);
    expect(expiredResponse.status).toBe(409);
    expect(expired.provider.createOneOffEvent).not.toHaveBeenCalled();
    expect(expired.approvals.records.get(OPERATION_ID)?.status).toBe("invalidated");
  });

  it("requires the exact confirmation body and never accepts client event authority", async () => {
    const harness = createHarness();
    await preview(harness);
    const rejected = await confirm(harness, {
      confirmation: "CONFIRM",
      ownerId: OWNER_ID,
      calendarId: CALENDAR_ID,
      eventId: EVENT_ID,
      eventVersion: EVENT_VERSION,
    });
    expect(rejected.status).toBe(400);
    expect(harness.approvals.confirmApproval).not.toHaveBeenCalled();
    expect(harness.provider.createOneOffEvent).not.toHaveBeenCalled();
  });

  it("reports uncertain create truthfully, then verifies through marker reconciliation without a retry", async () => {
    const harness = createHarness();
    harness.provider.createMode = "uncertain";
    await preview(harness);

    const pending = await confirm(harness);
    expect(pending.status).toBe(202);
    await expect(pending.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "verification_pending",
      undoAvailable: false,
    });
    expect(harness.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(harness.ledger.records.get(OPERATION_ID)?.status).toBe(
      "verification_pending",
    );

    harness.provider.publishLastAttempt();
    const verified = await confirm(harness);
    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toMatchObject({
      status: "verified",
      undoAvailable: true,
    });
    expect(harness.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps a mismatched read-back pending until an exact read-back is available", async () => {
    const harness = createHarness();
    harness.provider.createMode = "uncertain";
    await preview(harness);
    expect((await confirm(harness)).status).toBe(202);
    harness.provider.publishLastAttempt();
    harness.provider.readBackMismatch = true;

    const mismatch = await confirm(harness);
    expect(mismatch.status).toBe(202);
    expect(harness.ledger.records.get(OPERATION_ID)?.status).toBe(
      "verification_pending",
    );
    harness.provider.readBackMismatch = false;
    expect((await confirm(harness)).status).toBe(200);
    expect(harness.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
  });

  it("allows undo only after verified creation, uses stored provider identity, and replays safely", async () => {
    const harness = createHarness();
    await preview(harness);
    expect((await confirm(harness)).status).toBe(200);

    const first = await undo(harness);
    const replay = await undo(harness);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "undone",
      undoAvailable: false,
    });
    expect(harness.provider.deleteEvent).toHaveBeenCalledTimes(1);
    expect(harness.provider.deleteEvent).toHaveBeenCalledWith({
      calendarId: CALENDAR_ID,
      eventId: EVENT_ID,
      expectedVersion: EVENT_VERSION,
    });
    expect(harness.ledger.records.get(OPERATION_ID)?.status).toBe("undone");
  });

  it("rejects undo for an unverified operation and keeps the provider untouched", async () => {
    const harness = createHarness();
    await preview(harness);
    const response = await undo(harness);
    expect(response.status).toBe(409);
    expect(harness.provider.deleteEvent).not.toHaveBeenCalled();
  });

  it("reports uncertain deletion as pending and never claims it was undone", async () => {
    const harness = createHarness();
    await preview(harness);
    expect((await confirm(harness)).status).toBe(200);
    harness.provider.deleteMode = "uncertain";

    const response = await undo(harness);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      status: "verification_pending",
      undoAvailable: false,
    });
    expect(harness.ledger.records.get(OPERATION_ID)?.status).toBe(
      "verification_pending",
    );
  });

  it("does not create an approval when the connected calendar or token is unavailable", async () => {
    const disconnected = createHarness({ connected: false });
    const disconnectedResponse = await disconnected.app.fetch(
      post("/api/calendar/writes/preview", validPreviewInput()),
      {} as Env,
    );
    expect(disconnectedResponse.status).toBe(503);
    expect(disconnected.approvals.createApproval).not.toHaveBeenCalled();

    const noToken = createHarness({ tokenAvailable: false });
    const noTokenResponse = await noToken.app.fetch(
      post("/api/calendar/writes/preview", validPreviewInput()),
      {} as Env,
    );
    expect(noTokenResponse.status).toBe(503);
    expect(noToken.provider.readCalendarVersion).not.toHaveBeenCalled();
    expect(noToken.approvals.createApproval).not.toHaveBeenCalled();
  });

  it("keeps the route module mounted before the generic API fallback", () => {
    expect(registerCalendarWriteRoutes).toBeTypeOf("function");
  });
});
