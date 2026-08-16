import { describe, expect, it } from "vitest";
import {
  CalendarWriteContractError,
  createCalendarWriteProposal,
  transitionCalendarWrite,
  type CalendarWriteProposalInput,
} from "../../../src/domain/calendar-write/approval";

const validInput = (): CalendarWriteProposalInput => ({
  operationId: "op-phase-c-001",
  ownerId: "owner-phase-c",
  target: { calendarId: "calendar-vision", version: "etag-001" },
  requestedAt: "2026-08-16T14:00:00.000Z",
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

describe("calendar write approval contract", () => {
  it("creates an exact immutable one-off before/after preview", () => {
    const proposal = createCalendarWriteProposal(validInput());

    expect(proposal).toMatchObject({
      operationId: "op-phase-c-001",
      action: "create",
      status: "proposed",
      target: { calendarId: "calendar-vision", version: "etag-001" },
      preview: {
        before: null,
        after: {
          title: "Focus block",
          description: "Protected planning note",
          startsAt: "2026-08-17T15:00:00.000Z",
          endsAt: "2026-08-17T16:00:00.000Z",
          timeZone: "America/Chicago",
          domain: "work",
          privacy: "private",
          attendees: { mode: "none", count: 0, addresses: [] },
          recurrence: { scope: "one-off", rules: [] },
          notifications: { policy: "none", willNotify: false },
        },
      },
    });
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.preview)).toBe(true);
    expect(Object.isFrozen(proposal.preview.after)).toBe(true);
  });

  it("rejects non-empty attendees with a stable reason code", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, attendees: ["person@example.test"] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_ATTENDEES" }),
    );
  });

  it("rejects recurrence input instead of silently dropping it", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, recurrence: ["RRULE:FREQ=DAILY"] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_RECURRENCE" }),
    );
  });

  it("rejects a non-none notification policy instead of hiding provider effects", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, notifications: "all" },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_NOTIFICATIONS" }),
    );
  });

  it("rejects an interval whose end is not after its start", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: {
          ...validInput().event,
          endsAt: validInput().event.startsAt,
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_PROPOSAL_INPUT" }),
    );
  });

  it("invalidates approval when the target calendar version is stale", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const invalidated = transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-002" },
    });

    expect(invalidated.status).toBe("invalidated");
    expect(invalidated.invalidatedReason).toBe("STALE_TARGET_VERSION");
  });

  it("allows only confirmed operations to enter writing and then a terminal result", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const confirmed = transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-001" },
    });
    const writing = transitionCalendarWrite(confirmed, { kind: "begin_write" });
    const verified = transitionCalendarWrite(writing, { kind: "verified" });

    expect(confirmed.status).toBe("confirmed");
    expect(writing.status).toBe("writing");
    expect(verified.status).toBe("verified");
  });

  it("rejects a write transition before confirmation", () => {
    expect(() =>
      transitionCalendarWrite(createCalendarWriteProposal(validInput()), {
        kind: "begin_write",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE_TRANSITION" }),
    );
  });

  it("does not mutate the proposal while transitioning it", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const original = JSON.stringify(proposal);

    transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-001" },
    });

    expect(JSON.stringify(proposal)).toBe(original);
    expect(proposal.status).toBe("proposed");
  });

  it("rejects unsupported object shapes without invoking getters", () => {
    let getterCalled = false;
    const input = validInput() as unknown as Record<string, unknown>;
    Object.defineProperty(input, "unexpected", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "should not be read";
      },
    });

    expect(() => createCalendarWriteProposal(input)).toThrowError(
      expect.objectContaining({ code: "INVALID_PROPOSAL_INPUT" }),
    );
    expect(getterCalled).toBe(false);
  });

  it("exposes stable error codes without reflecting rejected values", () => {
    try {
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, title: "" },
      });
      throw new Error("expected proposal creation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CalendarWriteContractError);
      expect(error).toMatchObject({ code: "INVALID_PROPOSAL_INPUT" });
      expect((error as Error).message).not.toContain("title");
    }
  });
});
