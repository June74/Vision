import { describe, expect, it } from "vitest";
import {
  createCalendarWriteMutationProposal,
  type CalendarWriteMutationEventInput,
} from "../../../src/domain/calendar-write/event-mutation";

const NOW = "2026-08-20T23:00:00.000Z";

function eventInput(overrides: Partial<CalendarWriteMutationEventInput> = {}): CalendarWriteMutationEventInput {
  return {
    title: "Weekly focus",
    description: null,
    startsAt: "2026-08-21T19:00:00.000Z",
    endsAt: "2026-08-21T20:00:00.000Z",
    timeZone: "America/Chicago",
    domain: "work",
    privacy: "private",
    status: "confirmed",
    attendees: [],
    recurrence: null,
    notifications: "none",
    ...overrides,
  };
}

function proposalInput(
  overrides: Partial<Parameters<typeof createCalendarWriteMutationProposal>[0]> = {},
) {
  const before = eventInput({
    attendees: ["alice@example.com", "bob@example.com"],
    recurrence: {
      scope: "series",
      rules: ["RRULE:FREQ=WEEKLY;COUNT=4"],
    },
    notifications: "provider-default",
  });
  const after = eventInput({
    title: "Weekly focus — revised",
    attendees: ["alice@example.com", "carol@example.com"],
    recurrence: {
      scope: "series",
      rules: ["RRULE:FREQ=WEEKLY;COUNT=4"],
    },
    notifications: "provider-default",
  });
  return {
    operationId: "op-recurrence-001",
    ownerId: "owner-recurrence",
    action: "update" as const,
    target: {
      calendarId: "calendar-vision",
      eventId: "event-recurring-001",
      version: "etag-recurring-001",
      scope: "series" as const,
    },
    requestedAt: NOW,
    before,
    after,
    ...overrides,
  };
}

describe("Phase C recurrence, attendee, and notification contract", () => {
  it("retains recurring scope and attendee content in the immutable proposal while exposing only counts", () => {
    const proposal = createCalendarWriteMutationProposal(proposalInput());

    expect(proposal.target.scope).toBe("series");
    expect(proposal.preview.before.attendees).toMatchObject({ mode: "count", count: 2 });
    expect(proposal.preview.after?.attendees).toMatchObject({ mode: "count", count: 2 });
    expect(proposal.preview.before.recurrence).toEqual({
      scope: "series",
      rules: ["RRULE:FREQ=WEEKLY;COUNT=4"],
    });
    expect(proposal.preview.before.notifications).toEqual({
      policy: "provider-default",
      willNotify: true,
    });
    expect(Object.isFrozen(proposal)).toBe(true);
  });

  it("supports one-occurrence scope without silently expanding to the series", () => {
    const proposal = createCalendarWriteMutationProposal(proposalInput({
      target: {
        calendarId: "calendar-vision",
        eventId: "event-occurrence-001",
        version: "etag-occurrence-001",
        scope: "single",
      },
      before: eventInput({
        recurrence: { scope: "occurrence", rules: [] },
      }),
      after: eventInput({
        title: "One occurrence revised",
        recurrence: { scope: "occurrence", rules: [] },
      }),
    }));

    expect(proposal.target.scope).toBe("single");
    expect(proposal.preview.before.recurrence.scope).toBe("occurrence");
  });

  it("rejects malformed recurrence rules and unsupported notification policies", () => {
    expect(() => createCalendarWriteMutationProposal(proposalInput({
      before: eventInput({ recurrence: { scope: "series", rules: ["not-an-rrule"] } }),
    }))).toThrowError(expect.objectContaining({ code: "INVALID_MUTATION_PREVIEW" }));

    expect(() => createCalendarWriteMutationProposal(proposalInput({
      before: eventInput({ notifications: "controlled" as never }),
    }))).toThrowError(expect.objectContaining({ code: "INVALID_MUTATION_INPUT" }));
  });

  it("rejects hidden attendee addresses and recurrence rules beyond the contract bound", () => {
    expect(() => createCalendarWriteMutationProposal(proposalInput({
      before: eventInput({ attendees: ["not-an-email"] }),
    }))).toThrowError(expect.objectContaining({ code: "INVALID_MUTATION_INPUT" }));

    expect(() => createCalendarWriteMutationProposal(proposalInput({
      before: eventInput({
        recurrence: {
          scope: "series",
          rules: Array.from({ length: 21 }, (_, index) => `RRULE:FREQ=DAILY;COUNT=${index + 1}`),
        },
      }),
    }))).toThrowError(expect.objectContaining({ code: "INVALID_MUTATION_INPUT" }));
  });
});
