import { describe, expect, it } from "vitest";
import { buildBriefing } from "../../../src/domain/briefings/briefing";

describe("template-backed briefings", () => {
  it("keeps items inside an explicit morning window and cites their source facts", () => {
    const briefing = buildBriefing({
      briefingId: "briefing-1",
      window: {
        kind: "morning",
        startsAt: "2026-08-20T12:00:00.000Z",
        endsAt: "2026-08-20T17:00:00.000Z",
        timeZone: "America/Chicago",
      },
      events: [
        {
          id: "event-in-window",
          title: "Standup",
          startsAt: "2026-08-20T14:00:00.000Z",
          endsAt: "2026-08-20T14:30:00.000Z",
          timeZone: "America/Chicago",
          status: "confirmed",
          busy: true,
          sourceFactId: "source:event-in-window",
        },
        {
          id: "event-outside",
          title: "Evening event",
          startsAt: "2026-08-20T23:00:00.000Z",
          endsAt: "2026-08-21T00:00:00.000Z",
          timeZone: "America/Chicago",
          status: "confirmed",
          busy: true,
          sourceFactId: "source:event-outside",
        },
      ],
      tasks: [{
        id: "task-1",
        title: "Send summary",
        dueAt: "2026-08-20T15:00:00.000Z",
        timeZone: "America/Chicago",
        status: "open",
        sourceFactId: "source:task-1",
      }],
      followUps: [{
        id: "follow-up-1",
        title: "Check back with Alex",
        dueAt: "2026-08-20T16:00:00.000Z",
        timeZone: "America/Chicago",
        sourceFactIds: ["source:follow-up-1"],
        status: "open",
        createdAt: "2026-08-19T16:00:00.000Z",
        updatedAt: "2026-08-19T16:00:00.000Z",
        snoozedUntil: null,
        completedAt: null,
      }],
      sourceFacts: [
        { id: "source:event-in-window", kind: "calendar_event", label: "Standup" },
        { id: "source:task-1", kind: "secretary_task", label: "Send summary" },
        { id: "source:follow-up-1", kind: "follow_up", label: "Check back with Alex" },
      ],
    });

    expect(briefing.window).toMatchObject({ kind: "morning", timeZone: "America/Chicago" });
    expect(briefing.sections.find((section) => section.kind === "calendar")?.items)
      .toHaveLength(1);
    expect(briefing.sections.find((section) => section.kind === "tasks")?.items)
      .toHaveLength(1);
    expect(briefing.sections.find((section) => section.kind === "follow_ups")?.items)
      .toHaveLength(1);
    expect(briefing.citations.map((citation) => citation.sourceFactId)).toEqual([
      "source:event-in-window",
      "source:task-1",
      "source:follow-up-1",
    ]);
    expect(briefing.automation).toEqual({ mode: "template", aiEnabled: false });
    expect(briefing.calendarWrite).toEqual({
      authority: "approval-required",
      canConfirm: false,
    });
  });
});
