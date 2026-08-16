import { describe, expect, it, vi } from "vitest";
import {
  createCalendarWriteProposal,
  transitionCalendarWrite,
  type CalendarWriteProposal,
  type CalendarWriteProposalInput,
} from "../../../src/domain/calendar-write/approval";
import {
  CalendarWriteProviderError,
  executeConfirmedCalendarCreate,
  undoVerifiedCalendarCreate,
  type CalendarWriteAudit,
  type CalendarWriteLedger,
  type CalendarWriteLedgerRecord,
  type CalendarWriteProvider,
  type CalendarWriteProviderEvent,
} from "../../../src/domain/calendar-write/create-execution";

const NOW = "2026-08-16T19:30:00.000Z";

const proposalInput = (): CalendarWriteProposalInput => ({
  operationId: "op-phase-c-002",
  ownerId: "owner-phase-c",
  target: { calendarId: "calendar-vision", version: "etag-calendar-001" },
  requestedAt: NOW,
  event: {
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-17T15:00:00.000Z",
    endsAt: "2026-08-17T16:00:00.000Z",
    timeZone: "America/Chicago",
    domain: "work",
    privacy: "private",
    attendees: [],
    recurrence: null,
    notifications: "none",
  },
});

function confirmedProposal(): CalendarWriteProposal {
  const proposed = createCalendarWriteProposal(proposalInput());
  return transitionCalendarWrite(proposed, {
    kind: "approve",
    target: proposed.target,
  });
}

function providerEvent(
  operationId = "op-phase-c-002",
  overrides: Partial<CalendarWriteProviderEvent> = {},
): CalendarWriteProviderEvent {
  return {
    eventId: "event-001",
    version: "etag-event-001",
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-17T15:00:00.000Z",
    endsAt: "2026-08-17T16:00:00.000Z",
    timeZone: "America/Chicago",
    operationId,
    domain: "work",
    privacy: "private",
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
    this.records.set(`${ownerId}:${operationId}`, {
      ...this.required(ownerId, operationId),
      status: "verification_pending",
    });
  }

  async markVerified(
    ownerId: string,
    operationId: string,
    calendarId: string,
    eventId: string,
    eventVersion: string,
  ): Promise<void> {
    this.records.set(`${ownerId}:${operationId}`, {
      ...this.required(ownerId, operationId),
      status: "verified",
      eventId,
      eventVersion,
    });
  }

  async markFailed(ownerId: string, operationId: string): Promise<void> {
    this.records.set(`${ownerId}:${operationId}`, {
      ...this.required(ownerId, operationId),
      status: "failed",
    });
  }

  async markUndone(ownerId: string, operationId: string): Promise<void> {
    this.records.set(`${ownerId}:${operationId}`, {
      ...this.required(ownerId, operationId),
      status: "undone",
    });
  }

  private required(ownerId: string, operationId: string): CalendarWriteLedgerRecord {
    const record = this.records.get(`${ownerId}:${operationId}`);
    if (!record) throw new Error("ledger fixture record missing");
    return record;
  }
}

function harness(options: {
  readonly currentVersion?: string;
  readonly createResult?: CalendarWriteProviderEvent;
  readonly createError?: CalendarWriteProviderError;
  readonly markerMatches?: readonly CalendarWriteProviderEvent[];
  readonly readResult?: CalendarWriteProviderEvent;
  readonly deleteResult?: "deleted" | "not_found";
  readonly deleteError?: CalendarWriteProviderError;
} = {}) {
  const event = options.createResult ?? providerEvent();
  const ledger = new MemoryLedger();
  const audits: Parameters<CalendarWriteAudit["write"]>[0][] = [];
  const provider: CalendarWriteProvider = {
    readCalendarVersion: vi.fn(async () => ({
      calendarId: "calendar-vision",
      version: options.currentVersion ?? "etag-calendar-001",
    })),
    createOneOffEvent: vi.fn(async () => {
      if (options.createError) throw options.createError;
      return event;
    }),
    findByOperationId: vi.fn(async () => options.markerMatches ?? []),
    readEvent: vi.fn(async () => options.readResult ?? event),
    deleteEvent: vi.fn(async () => {
      if (options.deleteError) throw options.deleteError;
      return options.deleteResult ?? "deleted";
    }),
  };
  const audit: CalendarWriteAudit = {
    write: vi.fn(async (entry) => {
      audits.push(entry);
    }),
  };
  return { provider, ledger, audit, audits };
}

describe("Phase C one-off calendar-create executor", () => {
  it("invalidates a stale target before claiming or creating", async () => {
    const dependencies = harness({ currentVersion: "etag-calendar-002" });

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("invalidated");
    expect(dependencies.ledger.records).toEqual(new Map());
    expect(dependencies.provider.createOneOffEvent).not.toHaveBeenCalled();
    expect(dependencies.audits[0]).toMatchObject({
      action: "calendar.event.create",
      outcome: "denied",
      errorCategory: "calendar_target_stale",
    });
  });

  it("creates once, reads back exactly, audits success, and returns undo metadata", async () => {
    const dependencies = harness();

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result).toMatchObject({
      status: "verified",
      operationId: "op-phase-c-002",
      ownerId: "owner-phase-c",
      eventId: "event-001",
      eventVersion: "etag-event-001",
      undo: { operationId: "op-phase-c-002", eventId: "event-001" },
    });
    expect(dependencies.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.createOneOffEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "calendar-vision",
        operationId: "op-phase-c-002",
        title: "Focus block",
        notifications: "none",
      }),
    );
    expect(dependencies.audits[0]).toMatchObject({
      action: "calendar.event.create",
      outcome: "succeeded",
      provider: "google_calendar",
    });
  });

  it("replays a verified operation without reading or creating again", async () => {
    const dependencies = harness();
    dependencies.ledger.records.set("owner-phase-c:op-phase-c-002", {
      ownerId: "owner-phase-c",
      operationId: "op-phase-c-002",
      calendarId: "calendar-vision",
      status: "verified",
      eventId: "event-previous",
      eventVersion: "etag-previous",
    });

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result).toMatchObject({ status: "verified", eventId: "event-previous" });
    expect(dependencies.provider.readCalendarVersion).not.toHaveBeenCalled();
    expect(dependencies.provider.createOneOffEvent).not.toHaveBeenCalled();
    expect(dependencies.audits).toEqual([]);
  });

  it("reconciles one marker match after an uncertain create without inserting again", async () => {
    const event = providerEvent();
    const dependencies = harness({
      createError: new CalendarWriteProviderError("uncertain"),
      markerMatches: [event],
      readResult: event,
    });

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verified");
    expect(dependencies.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.findByOperationId).toHaveBeenCalledTimes(1);
    expect(dependencies.audits[0]).toMatchObject({ outcome: "succeeded" });
  });

  it("keeps an uncertain create pending when no marker match is found", async () => {
    const dependencies = harness({
      createError: new CalendarWriteProviderError("uncertain"),
      markerMatches: [],
    });

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verification_pending");
    expect(dependencies.provider.createOneOffEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.provider.findByOperationId).toHaveBeenCalledTimes(1);
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "pending",
      errorCategory: "provider_uncertain",
    });
  });

  it("keeps audit history distinct when a pending create later verifies", async () => {
    const dependencies = harness({
      createError: new CalendarWriteProviderError("uncertain"),
      markerMatches: [],
    });
    const proposal = confirmedProposal();

    await expect(
      executeConfirmedCalendarCreate(proposal, { ...dependencies, now: () => NOW }),
    ).resolves.toMatchObject({ status: "verification_pending" });

    vi.mocked(dependencies.provider.findByOperationId).mockResolvedValue([
      providerEvent(),
    ]);
    await expect(
      executeConfirmedCalendarCreate(proposal, { ...dependencies, now: () => NOW }),
    ).resolves.toMatchObject({ status: "verified" });

    expect(dependencies.audits).toHaveLength(2);
    expect(dependencies.audits[0]?.id).not.toBe(dependencies.audits[1]?.id);
  });

  it("does not claim success when read-back differs from the approved preview", async () => {
    const dependencies = harness({
      readResult: providerEvent("op-phase-c-002", { title: "Changed title" }),
    });

    const result = await executeConfirmedCalendarCreate(
      confirmedProposal(),
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verification_pending");
    expect(dependencies.audits[0]).toMatchObject({
      outcome: "pending",
      errorCategory: "verification_mismatch",
    });
  });

  it("undoes one verified event only after delete and not-found read-back", async () => {
    const dependencies = harness({ deleteResult: "not_found" });
    dependencies.ledger.records.set("owner-phase-c:op-phase-c-002", {
      ownerId: "owner-phase-c",
      operationId: "op-phase-c-002",
      calendarId: "calendar-vision",
      status: "verified",
      eventId: "event-001",
      eventVersion: "etag-event-001",
    });

    const result = await undoVerifiedCalendarCreate(
      { ownerId: "owner-phase-c", operationId: "op-phase-c-002" },
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("undone");
    expect(dependencies.provider.deleteEvent).toHaveBeenCalledWith({
      calendarId: "calendar-vision",
      eventId: "event-001",
      expectedVersion: "etag-event-001",
    });
    expect(dependencies.audits[0]).toMatchObject({
      action: "calendar.event.undo",
      outcome: "succeeded",
    });
  });

  it("keeps an uncertain undo pending and never reports deletion as verified", async () => {
    const dependencies = harness({
      deleteError: new CalendarWriteProviderError("uncertain"),
    });
    dependencies.ledger.records.set("owner-phase-c:op-phase-c-002", {
      ownerId: "owner-phase-c",
      operationId: "op-phase-c-002",
      calendarId: "calendar-vision",
      status: "verified",
      eventId: "event-001",
      eventVersion: "etag-event-001",
    });

    const result = await undoVerifiedCalendarCreate(
      { ownerId: "owner-phase-c", operationId: "op-phase-c-002" },
      { ...dependencies, now: () => NOW },
    );

    expect(result.status).toBe("verification_pending");
    expect(dependencies.audits[0]).toMatchObject({
      action: "calendar.event.undo",
      outcome: "pending",
      errorCategory: "undo_uncertain",
    });
  });
});
