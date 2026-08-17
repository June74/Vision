import { describe, expect, it } from "vitest";
import {
  createSecretaryTask,
  transitionSecretaryTask,
} from "../../../../src/domain/secretary/task";

const NOW = new Date("2026-08-16T18:00:00.000Z");

describe("secretary tasks", () => {
  it("creates an open task and supports complete then undo", () => {
    const task = createSecretaryTask({
      id: "task-1",
      title: "Review the paper",
      dueAt: "2026-08-16T23:30:00.000Z",
      timeZone: "America/Chicago",
      createdAt: NOW,
    });
    const completed = transitionSecretaryTask(task, "complete", new Date("2026-08-16T19:00:00.000Z"));
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-08-16T19:00:00.000Z");
    const reopened = transitionSecretaryTask(completed, "undo", new Date("2026-08-16T20:00:00.000Z"));
    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeNull();
  });

  it("rejects a duplicate completion or malformed timezone", () => {
    const task = createSecretaryTask({
      id: "task-2",
      title: "Read",
      dueAt: null,
      timeZone: "UTC",
      createdAt: NOW,
    });
    const completed = transitionSecretaryTask(task, "complete", NOW);
    expect(() => transitionSecretaryTask(completed, "complete", NOW)).toThrow("Task transition is invalid.");
    expect(() => createSecretaryTask({
      id: "task-3",
      title: "Read",
      dueAt: null,
      timeZone: "Not/AZone",
      createdAt: NOW,
    })).toThrow("Task input is invalid.");
  });
});
