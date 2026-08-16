import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/worker";
import type { Env } from "../../src/server/env";
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
  type CalendarWriteMutationProvider,
  type CalendarWriteProviderEvent,
} from "../../src/domain/calendar-write/create-execution";
import type {
  CalendarWriteMutationProposal,
  CalendarWriteMutationEventInput,
} from "../../src/domain/calendar-write/event-mutation";
import {
  type CalendarWriteApprovalRecord,
  type CalendarWriteApprovalStore,
} from "../../src/data/repositories/calendar-write-repository";
import type { CalendarWriteRouteDependencies } from "../../src/server/api/calendar-write-routes";

const NOW = new Date("2026-08-20T23:00:00.000Z");
const OWNER_ID = "usr_private_pilot";
const OTHER_OWNER_ID = "usr_other_owner";
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const SUBJECT = "google-subject";
const ACCESS_TOKEN = "access-token";
const CALENDAR_ID = "vision-calendar";
const EVENT_ID = "event-vision-001";
const EVENT_VERSION = "etag-event-001";
const OPERATION_ID = "op-mutation-route-001";

function connectionSnapshot(): CalendarSetupSnapshot {
  const connection: CalendarConnection = {
    calendarId: CALENDAR_ID,
    connectionKind: "existing",
    timeZone: "America/Chicago",
    providerEtag: "etag-calendar-001",
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

function providerEvent(overrides: Partial<CalendarWriteProviderEvent> = {}): CalendarWriteProviderEvent {
  return {
    eventId: EVENT_ID,
    version: EVENT_VERSION,
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-21T19:00:00.000Z",
    endsAt: "2026-08-21T20:00:00.000Z",
    timeZone: "America/Chicago",
    operationId: "op-existing-event",
    domain: "work",
    privacy: "private",
    status: "confirmed",
    attendees: [],
    recurrence: null,
    notifications: "none",
    ...overrides,
  };
}

function snapshotInput(event: CalendarWriteProviderEvent): CalendarWriteMutationEventInput {
  return {
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    domain: event.domain,
    privacy: event.privacy,
    status: event.status ?? "confirmed",
    attendees: [],
    recurrence: null,
    notifications: "none",
  };
}

class MemoryApprovals implements CalendarWriteApprovalStore {
  proposal?: CalendarWriteMutationProposal;
  status: "proposed" | "confirmed" | "invalidated" = "proposed";
  requestedAt = NOW;
  expiresAt = new Date(NOW.getTime() + 600_000);

  async createApproval(): Promise<void> {}

  async createMutationApproval(input: {
    readonly proposal: CalendarWriteMutationProposal;
    readonly requestedAt: Date;
    readonly expiresAt: Date;
  }): Promise<void> {
    this.proposal = input.proposal;
    this.requestedAt = input.requestedAt;
    this.expiresAt = input.expiresAt;
    this.status = "proposed";
  }

  async findApproval(ownerId: string, operationId: string): Promise<CalendarWriteApprovalRecord | undefined> {
    if (!this.proposal || this.proposal.ownerId !== ownerId || this.proposal.operationId !== operationId) return undefined;
    return {
      ownerId,
      operationId,
      provider: "google",
      calendarId: this.proposal.target.calendarId,
      proposalDomain: this.proposal.preview.before.domain,
      action: this.proposal.action,
      eventId: this.proposal.target.eventId,
      eventVersion: this.proposal.target.version,
      scope: this.proposal.target.scope,
      status: this.status,
      requestedAt: this.requestedAt,
      expiresAt: this.expiresAt,
    };
  }

  async loadProposal(): Promise<never> {
    throw new Error("create proposal path not used");
  }

  async loadMutationProposal(ownerId: string, operationId: string): Promise<CalendarWriteMutationProposal | undefined> {
    if (!this.proposal || this.proposal.ownerId !== ownerId || this.proposal.operationId !== operationId || this.status === "invalidated") return undefined;
    return this.proposal;
  }

  async confirmApproval(ownerId: string, operationId: string, now: Date): Promise<"confirmed" | "already_confirmed" | "expired" | "missing"> {
    if (!this.proposal || this.proposal.ownerId !== ownerId || this.proposal.operationId !== operationId) return "missing";
    if (this.status === "confirmed") return "already_confirmed";
    if (this.status !== "proposed") return "missing";
    if (this.expiresAt.getTime() <= now.getTime()) {
      this.status = "invalidated";
      return "expired";
    }
    this.status = "confirmed";
    return "confirmed";
  }

  async invalidateApproval(ownerId: string, operationId: string): Promise<void> {
    if (this.proposal?.ownerId === ownerId && this.proposal.operationId === operationId) this.status = "invalidated";
  }
}

class MemoryLedger implements CalendarWriteLedger {
  readonly records = new Map<string, CalendarWriteLedgerRecord>();

  async find(ownerId: string, operationId: string): Promise<CalendarWriteLedgerRecord | undefined> {
    return this.records.get(`${ownerId}:${operationId}`);
  }

  async claim(ownerId: string, operationId: string, calendarId: string): Promise<"claimed" | "existing"> {
    const key = `${ownerId}:${operationId}`;
    if (this.records.has(key)) return "existing";
    this.records.set(key, { ownerId, operationId, calendarId, status: "writing" });
    return "claimed";
  }

  async markPending(ownerId: string, operationId: string): Promise<void> {
    const record = this.records.get(`${ownerId}:${operationId}`);
    if (record) this.records.set(`${ownerId}:${operationId}`, { ...record, status: "verification_pending" });
  }

  async markVerified(ownerId: string, operationId: string, calendarId: string, eventId: string, eventVersion: string): Promise<void> {
    this.records.set(`${ownerId}:${operationId}`, { ownerId, operationId, calendarId, status: "verified", eventId, eventVersion });
  }

  async markFailed(ownerId: string, operationId: string): Promise<void> {
    const record = this.records.get(`${ownerId}:${operationId}`);
    if (record) this.records.set(`${ownerId}:${operationId}`, { ...record, status: "failed" });
  }

  async markUndone(): Promise<void> {}
}

function createHarness(): {
  readonly app: ReturnType<typeof createApp>;
  readonly approvals: MemoryApprovals;
  readonly ledger: MemoryLedger;
  readonly provider: CalendarWriteMutationProvider;
} {
  const approvals = new MemoryApprovals();
  const ledger = new MemoryLedger();
  let current: CalendarWriteProviderEvent | undefined = providerEvent();
  const provider: CalendarWriteMutationProvider = {
    readCalendarVersion: vi.fn(async () => ({ calendarId: CALENDAR_ID, version: "etag-calendar-001" })),
    createOneOffEvent: vi.fn(),
    findByOperationId: vi.fn(async () => []),
    readEvent: vi.fn(async () => current),
    deleteEvent: vi.fn(async (): Promise<"deleted" | "not_found"> => {
      current = undefined;
      return "deleted";
    }),
    updateEvent: vi.fn(async (input) => {
      current = providerEvent({
        version: "etag-event-002",
        operationId: input.operationId,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timeZone: input.timeZone,
        status: input.status,
      });
      return current;
    }),
    moveEvent: vi.fn(async (input) => {
      current = providerEvent({
        version: "etag-event-002",
        operationId: input.operationId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timeZone: input.timeZone,
      });
      return current;
    }),
    cancelEvent: vi.fn(async (input) => {
      current = providerEvent({ version: "etag-event-002", operationId: input.operationId, status: "cancelled" });
      return current;
    }),
  };
  const sessions: Pick<EncryptedSessionRepository, "findSession"> = {
    findSession: vi.fn(async (sessionId: string) => sessionId === SESSION_ID
      ? {
          ownerId: OWNER_ID,
          googleSubject: SUBJECT,
          email: "owner@example.test",
          csrfToken: CSRF,
          createdAt: NOW,
          expiresAt: new Date(NOW.getTime() + 600_000),
        }
      : undefined),
  };
  const tokens: Pick<TokenRepositoryPort, "getGoogleTokens"> = {
    getGoogleTokens: vi.fn(async () => ({
      refreshToken: "refresh-token",
      accessToken: ACCESS_TOKEN,
      accessExpiresAt: new Date(NOW.getTime() + 600_000),
      grantedScopes: [],
      tokenVersion: 1,
      updatedAt: NOW,
    })),
  };
  const connectionRepository: Pick<CalendarRepositoryPort, "getSnapshot"> = {
    getSnapshot: vi.fn(async () => connectionSnapshot()),
  };
  const audit: CalendarWriteAudit = { write: vi.fn(async () => undefined) };
  const dependencies: CalendarWriteRouteDependencies = {
    logger: vi.fn(),
    now: () => NOW,
    createOperationId: vi.fn(() => OPERATION_ID),
    sessions,
    tokens,
    createCalendarRepository: () => connectionRepository,
    createProvider: vi.fn(() => provider),
    approvals,
    ledger,
    audit,
  };
  return { app: createApp({ calendarWrite: dependencies, logger: vi.fn() }), approvals, ledger, provider };
}

async function request(
  app: ReturnType<typeof createApp>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("cookie", `vision_session=${SESSION_ID}`);
  if (init.method === "POST") headers.set("x-vision-csrf", CSRF);
  return app.fetch(new Request(`https://vision.test${path}`, { ...init, headers }), {} as Env);
}

describe("Phase C calendar mutation routes", () => {
  it("derives the event target from the authenticated provider read and confirms with an exact action phrase", async () => {
    const harness = createHarness();
    const preview = await request(harness.app, "/api/calendar/mutations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "update",
        eventId: EVENT_ID,
        after: { title: "Updated focus block" },
      }),
    });

    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      action: "update",
      preview: {
        before: { title: "Focus block", status: "confirmed" },
        after: { title: "Updated focus block", status: "confirmed" },
      },
    });
    expect(harness.approvals.proposal?.target).toEqual({
      calendarId: CALENDAR_ID,
      eventId: EVENT_ID,
      version: EVENT_VERSION,
      scope: "single",
    });

    const confirmed = await request(harness.app, `/api/calendar/mutations/${OPERATION_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "CONFIRM EVENT UPDATE" }),
    });

    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({
      operationId: OPERATION_ID,
      action: "update",
      status: "verified",
    });
    expect(harness.provider.updateEvent).toHaveBeenCalledTimes(1);
    expect(harness.provider.deleteEvent).not.toHaveBeenCalled();
  });

  it("rejects a wrong confirmation phrase and never mutates a stale event", async () => {
    const harness = createHarness();
    const preview = await request(harness.app, "/api/calendar/mutations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", eventId: EVENT_ID, after: null }),
    });
    expect(preview.status).toBe(200);

    const wrongPhrase = await request(harness.app, `/api/calendar/mutations/${OPERATION_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "CONFIRM ONE-OFF EVENT" }),
    });
    expect(wrongPhrase.status).toBe(400);
    expect(harness.provider.deleteEvent).not.toHaveBeenCalled();

    harness.provider.readEvent = vi.fn(async () => providerEvent({ version: "etag-event-new" }));
    const stale = await request(harness.app, `/api/calendar/mutations/${OPERATION_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "CONFIRM EVENT DELETE" }),
    });
    expect(stale.status).toBe(409);
    expect(harness.provider.deleteEvent).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: "move" as const,
      after: {
        startsAt: "2026-08-21T21:00:00.000Z",
        endsAt: "2026-08-21T22:00:00.000Z",
        timeZone: "America/Chicago",
      },
      phrase: "CONFIRM EVENT MOVE",
      method: "moveEvent" as const,
    },
    {
      action: "cancel" as const,
      after: { status: "cancelled" as const },
      phrase: "CONFIRM EVENT CANCELLATION",
      method: "cancelEvent" as const,
    },
  ])("routes an approved $action through its reviewed provider method", async ({ action, after, phrase, method }) => {
    const harness = createHarness();
    const preview = await request(harness.app, "/api/calendar/mutations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, eventId: EVENT_ID, after }),
    });
    expect(preview.status).toBe(200);

    const confirmed = await request(harness.app, `/api/calendar/mutations/${OPERATION_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: phrase }),
    });

    expect(confirmed.status).toBe(200);
    await expect(confirmed.json()).resolves.toMatchObject({ action, status: "verified" });
    expect(harness.provider[method]).toHaveBeenCalledTimes(1);
  });

  it("requires authentication before parsing a mutation body", async () => {
    const harness = createHarness();
    const response = await harness.app.fetch(new Request("https://vision.test/api/calendar/mutations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), {} as Env);
    expect(response.status).toBe(401);
  });
});
