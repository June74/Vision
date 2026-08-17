import { describe, expect, it } from "vitest";
import {
  createFollowUp,
  FollowUpTransitionError,
  transitionFollowUp,
} from "../../../src/domain/follow-ups/follow-up";

const CREATED_AT = new Date("2026-08-20T14:00:00.000Z");

describe("follow-up lifecycle", () => {
  it("supports complete, reopen, and snooze transitions without calendar authority", () => {
    const followUp = createFollowUp({
      id: "follow-up-1",
      title: "Check back with Alex",
      dueAt: "2026-08-21T14:00:00.000Z",
      timeZone: "America/Chicago",
      sourceFactIds: ["source:conversation-1"],
      createdAt: CREATED_AT,
    });
    expect(followUp).toMatchObject({ status: "open", snoozedUntil: null, completedAt: null });

    const completed = transitionFollowUp(followUp, {
      action: "complete",
      at: new Date("2026-08-20T15:00:00.000Z"),
    });
    expect(completed).toMatchObject({ status: "completed", completedAt: "2026-08-20T15:00:00.000Z" });

    const reopened = transitionFollowUp(completed, {
      action: "reopen",
      at: new Date("2026-08-20T16:00:00.000Z"),
    });
    expect(reopened).toMatchObject({ status: "open", completedAt: null, snoozedUntil: null });

    const snoozed = transitionFollowUp(reopened, {
      action: "snooze",
      snoozedUntil: "2026-08-22T14:00:00.000Z",
      at: new Date("2026-08-20T16:00:00.000Z"),
    });
    expect(snoozed).toMatchObject({ status: "snoozed", snoozedUntil: "2026-08-22T14:00:00.000Z" });
  });

  it("rejects an incomplete transition request instead of guessing a deadline", () => {
    const followUp = createFollowUp({
      id: "follow-up-2",
      title: "Follow up",
      dueAt: null,
      timeZone: "UTC",
      sourceFactIds: [],
      createdAt: CREATED_AT,
    });

    expect(() => transitionFollowUp(followUp, {
      action: "snooze",
      at: CREATED_AT,
    })).toThrow(FollowUpTransitionError);
  });
});
