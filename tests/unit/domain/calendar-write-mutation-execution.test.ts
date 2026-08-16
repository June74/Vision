import { describe, expect, it, vi } from "vitest";
import {
  createCalendarWriteMutationProposal,
  transitionCalendarWriteMutation,
  type CalendarWriteMutationAction,
  type CalendarWriteMutationEvent,
  type CalendarWriteMutationEventInput,
  type CalendarWriteMutationProposal,
} from "../../../src/domain/calendar-write/event-mutation";
import {
  CalendarWriteProviderError,
  executeConfirmedCalendarMutation,
  type CalendarWriteAudit,
  type CalendarWriteLedger,
  type CalendarWriteLedgerRecord,
  type CalendarWriteMutationProvider,
  type CalendarWriteProviderEvent,
} from "../../../src/domain/calendar-write/mutation-execution";

const NOW = "2026-08-20T23:00:00.000Z";
const OWNER_ID = "owner-phase-c";
const OPERATION_ID = "op-phase-c-mutation-exec";
const CALENDAR_ID = "calendar-vision";
const EVENT_ID = "event-vision-001";
const VERSION = "etag-event-001";

function event(
  overrides: Partial<CalendarWriteMutationEvent> = {},
): CalendarWriteMutationEvent {
  return {
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-21T19:00:00.000Z",
    endsAt: "2026-08-21T20:00:00.000Z",
    timeZone: "America/Chicago",
    domain: "work",
    privacy: "private",
    status: "confirmed",
    attendees: { mode: "none", count: 0, addresses: [] },
    recurrence: { scope: "one-off", rules: [] },
    notifications: { policy: "none", willNotify: false },
    ...overrides,
  };
}

function eventInput(
  snapshot: CalendarWriteMutationEvent,
): CalendarWriteMutationEventInput {
  return {
    title: snapshot.title,
    description: snapshot.description,
    startsAt: snapshot.startsAt,
    endsAt: snapshot.endsAt,
    timeZone: snapshot.timeZone,
    domain: snapshot.domain,
    privacy: snapshot.privacy,
    status: snapshot.status,
    attendees: [],
    recurrence: null,
    notifications: "none",
  };
}

function proposal(
  action: CalendarWriteMutationAction,
  after: CalendarWriteMutationProposal["preview"]["after"],
): CalendarWriteMutationProposal {
  const proposed = createCalendarWriteMutationProposal({
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    action,
    target: {
      calendarId: CALENDAR_ID,
      eventId: EVENT_ID,
      version: VERSION,
      scope: "single",
    },
    requestedAt: NOW,
    before: eventInput(event()),
    after: after === null ? null : eventInput(after),
  });
  return transitionCalendarWriteMutation(proposed, {
    kind: "approve",
    target: proposed.target,
  });
}

function providerEvent(
  snapshot: CalendarWriteMutationEvent,
  overrides: Partial<CalendarWriteProviderEvent> = {},
): CalendarWriteProviderEvent {
  return {
    eventId: EVENT_ID,
    version: VERSION,
    title: snapshot.title,
    description: snapshot.description,
    startsAt: snapshot.startsAt,
    endsAt: snapshot.endsAt,
    timeZone: snapshot.timeZone,
    operationId: OPERATION_ID,
    domain: snapshot.domain,
    privacy: snapshot.privacy,
    status: snapshot.status,
    attendees: [],
    recurrence: null,
    notifications: "none",
    ...overrides,
  };
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

  async markVerified(
    ownerId: string,
    operationId: string,
    calendarId: string,
    eventId: string,
    eventVersion: string,
  ): Promise<void> {
    this.records.set(`${ownerId}:${operationId}`, {
      ownerId,
      operationId,
      calendarId,
      status: "verified",
      eventId,
      eventVersion,
    });
  }

  async markFailed(ownerId: string, operationId: string): Promise<void> {
    const record = this.records.get(`${ownerId}:${operationId}`);
    if (record) this.records.set(`${ownerId}:${operationId}`, { ...record, status: "failed" });
  }

  async markUndone(ownerId: string, operationId: string): Promise<void> {
    const record = this.records.get(`${ownerId}:${operationId}`);
    if (record) this.records.set(`${ownerId}:${operationId}`, { ...record, status: "undone" });
  }
}

function harness(options: {
  readonly action?: CalendarWriteMutationAction;
  readonly after?: CalendarWriteMutationProposal["preview"]["after"];
  readonly current?: CalendarWriteProviderEvent;
  readonly mutationError?: CalendarWriteProviderError;
  readonly mutationReadBack?: CalendarWriteProviderEvent | undefined;
} = {}) {
  const action = options.action ?? "update";
  const after = options.after === undefined
    ? event({ title: "Updated focus block" })
    : options.after;
  const operation = proposal(action, after);
  const before = providerEvent(operation.preview.before);
  let current: CalendarWriteProviderEvent | undefined = options.current ?? before;
  const readBack = options.mutationReadBack ?? providerEvent(operation.preview.after ?? operation.preview.before);
  const ledger = new MemoryLedger();
  const audits: Parameters<CalendarWriteAudit["write"]>[0][] = [];
  const provider: CalendarWriteMutationProvider = {
    readCalendarVersion: vi.fn(async () => ({ calendarId: CALENDAR_ID, version: "etag-calendar" })),
    createOneOffEvent: vi.fn(),
    findByOperationId: vi.fn(async () => []),
    readEvent: vi.fn(async () => current),
    deleteEvent: vi.fn(async (): Promise<"deleted" | "not_found"> => {
      if (options.mutationError) throw options.mutationError;
      current = undefined;
      return "deleted";
    }),
    updateEvent: vi.fn(async () => {
      if (options.mutationError) {
        current = readBack;
        throw options.mutationError;
      }
      current = readBack;
      return readBack;
    }),
    moveEvent: vi.fn(async () => {
      if (options.mutationError) {
        current = readBack;
        throw options.mutationError;
      }
      current = readBack;
      return readBack;
    }),
    cancelEvent: vi.fn(async () => {
      if (options.mutationError) {
        current = readBack;
        throw options.mutationError;
      }
      current = readBack;
      return readBack;
    }),
  };
  const audit: CalendarWriteAudit = {
    write: vi.fn(async (entry) => {
      audits.push(entry);
    }),
  };
  return { operation, provider, ledger, audit, audits };
}

describe("Phase C mutation executor", () => {
  it.each([
    ["update", "updateEvent"],
    ["move", "moveEvent"],
    ["cancel", "cancelEvent"],
  ] as const)("executes one %s with freshness and exact read-back", async (action, method) => {
    const after = action === "move"
      ? event({ startsAt: "2026-08-21T21:00:00.000Z", endsAt: "2026-08-21T22:00:00.000Z" })
      : action === "cancel"
        ? event({ status: "cancelled" })
        : event({ title: "Updated focus block" });
    const dependencies = harness({ action, after });

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verified");
    expect(dependencies.provider[method]).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.readEvent).toHaveBeenCalledTimes(2);
    expect(dependencies.ledger.records.get(`${OWNER_ID}:${OPERATION_ID}`)).toMatchObject({
      status: "verified",
      eventId: EVENT_ID,
    });
    expect(dependencies.audits[0]).toMatchObject({
      action: `calendar.event.${action}`,
      outcome: "succeeded",
    });
  });

  it("invalidates a stale event version before claiming or mutating", async () => {
    const dependencies = harness({
      current: providerEvent(event(), { version: "etag-event-new" }),
    });

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("invalidated");
    expect(dependencies.ledger.records).toEqual(new Map());
    expect(dependencies.provider.updateEvent).not.toHaveBeenCalled();
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "denied",
      errorCategory: "event_target_stale",
    });
  });

  it("reconciles one uncertain mutation without retrying the provider call", async () => {
    const dependencies = harness({
      mutationError: new CalendarWriteProviderError("uncertain"),
    });

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verified");
    expect(dependencies.provider.updateEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.readEvent).toHaveBeenCalledTimes(2);
    expect(dependencies.audits[0]).toMatchObject({ outcome: "succeeded" });
  });

  it("keeps a mutation pending when read-back does not match the approved after snapshot", async () => {
    const dependencies = harness({
      mutationReadBack: providerEvent(event({ title: "Different title" })),
    });

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verification_pending");
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "pending",
      errorCategory: "verification_mismatch",
    });
  });

  it("verifies direct delete only after provider absence and replays without a second delete", async () => {
    const dependencies = harness({ action: "delete", after: null });

    const first = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );
    const replay = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(first.status).toBe("verified");
    expect(replay.status).toBe("verified");
    expect(dependencies.provider.deleteEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.readEvent).toHaveBeenCalledTimes(2);
  });

  it("records a definite provider failure without claiming verification", async () => {
    const dependencies = harness({
      mutationError: new CalendarWriteProviderError("definite_failure"),
    });

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("failed");
    expect(dependencies.ledger.records.get(`${OWNER_ID}:${OPERATION_ID}`)?.status).toBe("failed");
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "failed",
      errorCategory: "provider_failure",
    });
  });

  it("keeps the result pending when durable verified state cannot be recorded", async () => {
    const dependencies = harness();
    vi.spyOn(dependencies.ledger, "markVerified").mockRejectedValue(new Error("ledger unavailable"));

    const result = await executeConfirmedCalendarMutation(
      dependencies.operation,
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verification_pending");
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "pending",
      errorCategory: "provider_uncertain",
    });
  });
});
