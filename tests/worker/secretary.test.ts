import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/worker";
import type { Env } from "../../src/server/env";
import type { EncryptedSessionRepository } from "../../src/data/repositories/session-repository";
import type {
  SecretaryCapture,
  FollowUp,
  SecretaryRepository,
  SecretaryTask,
  SecretaryTodaySource,
} from "../../src/data/repositories/secretary-repository";
import type { PlanningSourceSnapshot } from "../../src/domain/scheduling/proposal";
import type { SecretaryRouteDependencies } from "../../src/server/api/secretary-routes";

const NOW = new Date("2026-08-16T18:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";

class MemorySecretaryRepository implements SecretaryRepository {
  readonly captures: SecretaryCapture[] = [];
  readonly tasks: SecretaryTask[] = [];
  readonly followUps: FollowUp[] = [];
  readonly notes = [];

  async readToday(): Promise<SecretaryTodaySource> {
    return { captures: this.captures, tasks: this.tasks, notes: this.notes, events: [] };
  }

  async readPlanning(): Promise<PlanningSourceSnapshot> {
    return { events: [], tasks: [], followUps: this.followUps, sourceFacts: [] };
  }

  async createCapture(_ownerId: string, capture: SecretaryCapture): Promise<SecretaryCapture> {
    this.captures.push(capture);
    return capture;
  }

  async createTask(_ownerId: string, task: SecretaryTask): Promise<SecretaryTask> {
    this.tasks.push(task);
    return task;
  }

  async transitionTask(_ownerId: string, taskId: string, action: "complete" | "undo", at: Date): Promise<SecretaryTask | undefined> {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return undefined;
    const next = {
      ...task,
      status: action === "complete" ? "completed" : "open",
      completedAt: action === "complete" ? at.toISOString() : null,
    } as SecretaryTask;
    this.tasks.splice(this.tasks.indexOf(task), 1, next);
    return next;
  }

  async createNote(_ownerId: string, note: never): Promise<never> {
    return note;
  }

  async createFollowUp(_ownerId: string, followUp: FollowUp): Promise<FollowUp> {
    this.followUps.push(followUp);
    return followUp;
  }

  async transitionFollowUp(): Promise<FollowUp | undefined> {
    return undefined;
  }
}

function dependencies(repository: SecretaryRepository): SecretaryRouteDependencies {
  const sessions: Pick<EncryptedSessionRepository, "findSession"> = {
    findSession: vi.fn(async (sessionId: string) => sessionId === SESSION_ID
      ? {
          ownerId: OWNER_ID,
          googleSubject: "google-subject",
          email: "owner@example.com",
          csrfToken: CSRF,
          expiresAt: new Date("2026-08-17T00:00:00.000Z"),
        }
      : undefined),
  };
  return { now: () => NOW, sessions, repositoryForOwner: () => repository };
}

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cookie", `vision_session=${SESSION_ID}`);
  return new Request(`https://vision.test${path}`, { ...init, headers });
}

const ENV = {} as Env;

describe("secretary routes", () => {
  it("requires authentication before exposing local Today", async () => {
    const repository = new MemorySecretaryRepository();
    const app = createApp({ secretary: dependencies(repository) });
    const response = await app.fetch(new Request("https://vision.test/api/secretary/today"), ENV);
    expect(response.status).toBe(401);
  });

  it("stores an ambiguous capture and never returns a calendar confirmation authority", async () => {
    const repository = new MemorySecretaryRepository();
    const app = createApp({ secretary: dependencies(repository) });
    const response = await app.fetch(request("/api/secretary/captures", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vision-csrf": CSRF },
      body: JSON.stringify({ content: "remember to compare the two papers" }),
    }), ENV);
    expect(response.status).toBe(201);
    const body = await response.json() as Record<string, unknown>;
    expect(body.capture).toMatchObject({ kind: "ambiguous", ambiguity: "needs_clarification" });
    expect(body.calendarConfirmation).toBeUndefined();
  });

  it("keeps an explicit calendar candidate pending approval", async () => {
    const repository = new MemorySecretaryRepository();
    const app = createApp({ secretary: dependencies(repository) });
    const response = await app.fetch(request("/api/secretary/captures", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vision-csrf": CSRF },
      body: JSON.stringify({ content: "calendar: dentist Friday at 2" }),
    }), ENV);
    expect(response.status).toBe(201);
    const body = await response.json() as Record<string, unknown>;
    expect(body.capture).toMatchObject({ kind: "calendar_candidate" });
    expect(body.capture).toHaveProperty("calendarProposal.requiresExplicitApproval", true);
    expect(body.capture).toHaveProperty("calendarProposal.canConfirm", false);
  });
});
