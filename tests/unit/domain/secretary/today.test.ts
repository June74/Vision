import { describe, expect, it } from "vitest";
import { buildTodayProjection } from "../../../../src/domain/secretary/today";

describe("buildTodayProjection", () => {
  it("orders local tasks by the owner's timezone and never grants calendar authority", () => {
    const projection = buildTodayProjection({
      now: new Date("2026-08-16T18:00:00.000Z"),
      timeZone: "America/Chicago",
      tasks: [
        {
          id: "task-late",
          title: "Late task",
          dueAt: "2026-08-17T02:30:00.000Z",
          timeZone: "America/Chicago",
          status: "open",
          createdAt: "2026-08-16T17:00:00.000Z",
          completedAt: null,
        },
        {
          id: "task-early",
          title: "Early task",
          dueAt: "2026-08-16T23:30:00.000Z",
          timeZone: "America/Chicago",
          status: "open",
          createdAt: "2026-08-16T17:00:00.000Z",
          completedAt: null,
        },
        {
          id: "task-done",
          title: "Done task",
          dueAt: "2026-08-16T20:00:00.000Z",
          timeZone: "America/Chicago",
          status: "completed",
          createdAt: "2026-08-16T17:00:00.000Z",
          completedAt: "2026-08-16T18:30:00.000Z",
        },
      ],
      events: [{
        id: "event-1",
        title: "Read-only calendar event",
        startsAt: "2026-08-16T21:00:00.000Z",
        endsAt: "2026-08-16T22:00:00.000Z",
        timeZone: "America/Chicago",
        status: "confirmed",
      }],
      captures: [],
      notes: [],
    });

    expect(projection.dateKey).toBe("2026-08-16");
    expect(projection.tasks.map((task) => task.id)).toEqual(["task-early", "task-late"]);
    expect(projection.events[0]).toMatchObject({
      id: "event-1",
      readOnly: true,
      canWrite: false,
    });
    expect(projection.calendarWriteAuthority).toBe("approval-required");
  });

  it("rejects an invalid IANA timezone instead of silently using the server timezone", () => {
    expect(() => buildTodayProjection({
      now: new Date("2026-08-16T18:00:00.000Z"),
      timeZone: "Not/AZone",
      tasks: [],
      events: [],
      captures: [],
      notes: [],
    })).toThrow("Today timezone is invalid.");
  });
});
