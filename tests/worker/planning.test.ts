import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/worker";
import type { Env } from "../../src/server/env";
import type { EncryptedSessionRepository } from "../../src/data/repositories/session-repository";
import type {
  PlanningRepositoryPort,
  PlanningRouteDependencies,
} from "../../src/server/api/planning-routes";
import type { PlanningSourceSnapshot } from "../../src/domain/scheduling/proposal";
import type { FollowUp } from "../../src/domain/follow-ups/follow-up";

const NOW = new Date("2026-08-20T14:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";

class MemoryPlanningRepository implements PlanningRepositoryPort {
  readonly followUps: FollowUp[] = [];
  readonly snapshot: PlanningSourceSnapshot = {
    events: [{
      id: "event-busy",
      title: "Team review",
      startsAt: "2026-08-20T14:00:00.000Z",
      endsAt: "2026-08-20T15:00:00.000Z",
      timeZone: "America/Chicago",
      status: "confirmed",
      busy: true,
      sourceFactId: "source:event-busy",
    }],
    tasks: [],
    followUps: this.followUps,
    sourceFacts: [{
      id: "source:event-busy",
      kind: "calendar_event",
      label: "Team review",
    }],
  };

  async readPlanning(): Promise<PlanningSourceSnapshot> {
    return this.snapshot;
  }

  async createFollowUp(_ownerId: string, followUp: FollowUp): Promise<FollowUp> {
    this.followUps.push(followUp);
    return followUp;
  }

  async transitionFollowUp(
    _ownerId: string,
    id: string,
    action: "complete" | "reopen" | "snooze",
    at: Date,
    snoozedUntil?: string,
  ): Promise<FollowUp | undefined> {
    const current = this.followUps.find((candidate) => candidate.id === id);
    if (!current) return undefined;
    const next = {
      ...current,
      status: action === "complete" ? "completed" : action === "snooze" ? "snoozed" : "open",
      completedAt: action === "complete" ? at.toISOString() : null,
      snoozedUntil: action === "snooze" ? snoozedUntil ?? null : null,
      updatedAt: at.toISOString(),
    } as FollowUp;
    this.followUps.splice(this.followUps.indexOf(current), 1, next);
    return next;
  }
}

function dependencies(repository: PlanningRepositoryPort): PlanningRouteDependencies {
  const sessions: Pick<EncryptedSessionRepository, "findSession"> = {
    findSession: vi.fn(async (sessionId: string) => sessionId === SESSION_ID
      ? {
          ownerId: OWNER_ID,
          googleSubject: "google-subject",
          email: "owner@example.com",
          csrfToken: CSRF,
          expiresAt: new Date("2026-08-21T00:00:00.000Z"),
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

describe("planning routes", () => {
  it("requires authentication before exposing a briefing", async () => {
    const app = createApp({ planning: dependencies(new MemoryPlanningRepository()) });
    const response = await app.fetch(new Request("https://vision.test/api/planning/briefing"), ENV);
    expect(response.status).toBe(401);
  });

  it("returns a conflict-aware deterministic proposal without a calendar confirmation handle", async () => {
    const repository = new MemoryPlanningRepository();
    const app = createApp({ planning: dependencies(repository) });
    const response = await app.fetch(request("/api/planning/proposals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vision-csrf": CSRF },
      body: JSON.stringify({
        title: "Focus block",
        durationMinutes: 60,
        preferredStartAt: "2026-08-20T14:00:00.000Z",
        window: {
          startsAt: "2026-08-20T14:00:00.000Z",
          endsAt: "2026-08-20T18:00:00.000Z",
          timeZone: "America/Chicago",
        },
        ambiguity: [],
      }),
    }), ENV);
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body.proposal).toMatchObject({
      status: "conflict",
      calendarWrite: { authority: "approval-required", canConfirm: false, approvalOperationId: null },
    });
    expect(JSON.stringify(body)).not.toContain("calendarConfirmation");
  });

  it("creates and transitions owner-scoped local follow-ups", async () => {
    const repository = new MemoryPlanningRepository();
    const app = createApp({ planning: dependencies(repository) });
    const createResponse = await app.fetch(request("/api/planning/follow-ups", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vision-csrf": CSRF },
      body: JSON.stringify({
        title: "Check back with Alex",
        dueAt: "2026-08-21T14:00:00.000Z",
        timeZone: "America/Chicago",
        sourceFactIds: ["source:event-busy"],
      }),
    }), ENV);
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { followUp: FollowUp };

    const transitionResponse = await app.fetch(request(`/api/planning/follow-ups/${created.followUp.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vision-csrf": CSRF },
      body: "{}",
    }), ENV);
    expect(transitionResponse.status).toBe(200);
    expect(await transitionResponse.json()).toMatchObject({ followUp: { status: "completed" } });
  });
});
