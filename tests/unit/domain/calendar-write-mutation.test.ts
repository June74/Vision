import { describe, expect, it } from "vitest";
import {
  CalendarWriteContractError,
  createCalendarWriteMutationProposal,
  restoreCalendarWriteMutationProposal,
  transitionCalendarWriteMutation,
  type CalendarWriteMutationInput,
  type CalendarWriteMutationEventInput,
} from "../../../src/domain/calendar-write/event-mutation";

const event = (
  overrides: Partial<CalendarWriteMutationEventInput> = {},
): CalendarWriteMutationEventInput => ({
  title: "Focus block",
  description: "Protected planning note",
  startsAt: "2026-08-17T15:00:00.000Z",
  endsAt: "2026-08-17T16:00:00.000Z",
  timeZone: "America/Chicago",
  domain: "work" as const,
  privacy: "private" as const,
  status: "confirmed" as const,
  attendees: [],
  recurrence: null,
  notifications: "none" as const,
  ...overrides,
});

const input = (
  action: CalendarWriteMutationInput["action"],
  overrides: Partial<CalendarWriteMutationInput> = {},
): CalendarWriteMutationInput => ({
  operationId: "op-phase-c-mutation-001",
  ownerId: "owner-phase-c",
  action,
  target: {
    calendarId: "calendar-vision",
    eventId: "event-vision-001",
    version: "etag-event-001",
    scope: "single",
  },
  requestedAt: "2026-08-16T22:00:00.000Z",
  before: event(),
  after: event(),
  ...overrides,
});

describe("Phase C event mutation contract", () => {
  it("creates an immutable update preview with provider event identity", () => {
    const proposal = createCalendarWriteMutationProposal(
      input("update", { after: event({ title: "Updated focus block" }) }),
    );

    expect(proposal).toMatchObject({
      action: "update",
      status: "proposed",
      target: {
        calendarId: "calendar-vision",
        eventId: "event-vision-001",
        version: "etag-event-001",
        scope: "single",
      },
      preview: {
        before: { title: "Focus block", status: "confirmed" },
        after: { title: "Updated focus block", status: "confirmed" },
      },
    });
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.preview.before)).toBe(true);
    expect(Object.isFrozen(proposal.preview.after)).toBe(true);
  });

  it.each([
    ["move", { startsAt: "2026-08-17T16:00:00.000Z", endsAt: "2026-08-17T17:00:00.000Z" }],
    ["cancel", { status: "cancelled" }],
  ] as const)("creates a strict %s preview", (action, changes) => {
    const proposal = createCalendarWriteMutationProposal(
      input(action, { after: event(changes) }),
    );

    expect(proposal.action).toBe(action);
    expect(proposal.preview.before).toMatchObject({ status: "confirmed" });
    expect(proposal.preview.after).toMatchObject(changes);
  });

  it("represents direct deletion with no after snapshot", () => {
    const proposal = createCalendarWriteMutationProposal(
      input("delete", { after: null }),
    );

    expect(proposal.preview.after).toBeNull();
  });

  it("invalidates a proposal when event identity, calendar, or version is stale", () => {
    const proposal = createCalendarWriteMutationProposal(input("update"));

    const invalidated = transitionCalendarWriteMutation(proposal, {
      kind: "approve",
      target: {
        calendarId: "calendar-vision",
        eventId: "event-vision-002",
        version: "etag-event-002",
        scope: "single",
      },
    });

    expect(invalidated.status).toBe("invalidated");
    expect(invalidated.invalidatedReason).toBe("STALE_EVENT_VERSION");
  });

  it("allows only an approved proposal to enter writing and verification", () => {
    const proposal = createCalendarWriteMutationProposal(input("update"));
    const confirmed = transitionCalendarWriteMutation(proposal, {
      kind: "approve",
      target: proposal.target,
    });
    const writing = transitionCalendarWriteMutation(confirmed, { kind: "begin_write" });
    const verified = transitionCalendarWriteMutation(writing, { kind: "verified" });

    expect(confirmed.status).toBe("confirmed");
    expect(writing.status).toBe("writing");
    expect(verified.status).toBe("verified");
  });

  it("rejects action-specific preview shape violations with stable errors", () => {
    expect(() => createCalendarWriteMutationProposal(input("delete"))).toThrowError(
      expect.objectContaining({ code: "INVALID_MUTATION_PREVIEW" }),
    );
    expect(() => createCalendarWriteMutationProposal(input("cancel", { after: event() }))).toThrowError(
      expect.objectContaining({ code: "INVALID_MUTATION_PREVIEW" }),
    );
    expect(() => createCalendarWriteMutationProposal(input("update", { after: null }))).toThrowError(
      expect.objectContaining({ code: "INVALID_MUTATION_PREVIEW" }),
    );
  });

  it("rejects series scope until recurrence semantics are explicitly approved", () => {
    expect(() => createCalendarWriteMutationProposal(input("update", {
      target: {
        calendarId: "calendar-vision",
        eventId: "event-vision-001",
        version: "etag-event-001",
        scope: "series",
      },
    }))).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_MUTATION_SCOPE" }),
    );
  });

  it("does not invoke getters while rejecting unknown input", () => {
    let getterCalled = false;
    const value = input("update") as unknown as Record<string, unknown>;
    Object.defineProperty(value, "unexpected", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "private";
      },
    });

    expect(() => createCalendarWriteMutationProposal(value)).toThrowError(
      expect.objectContaining({ code: "INVALID_MUTATION_INPUT" }),
    );
    expect(getterCalled).toBe(false);
  });

  it("restores only the exact persisted proposed shape", () => {
    const proposal = createCalendarWriteMutationProposal(input("update", {
      after: event({ title: "Updated focus block" }),
    }));

    expect(
      restoreCalendarWriteMutationProposal(JSON.parse(JSON.stringify(proposal))),
    ).toEqual(proposal);
    expect(() => restoreCalendarWriteMutationProposal({ ...proposal, status: "confirmed" }))
      .toThrowError(expect.objectContaining({ code: "INVALID_MUTATION_INPUT" }));
  });

  it("does not expose rejected values through contract errors", () => {
    try {
      createCalendarWriteMutationProposal(input("update", {
        before: event({ title: "PRIVATE_SENTINEL" }),
        after: event({ title: "" }),
      }));
      throw new Error("expected mutation proposal rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(CalendarWriteContractError);
      expect((error as Error).message).not.toContain("PRIVATE_SENTINEL");
    }
  });
});
