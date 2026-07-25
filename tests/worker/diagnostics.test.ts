import { describe, expect, it, vi } from "vitest";
import type { AiUsageRepository } from "../../src/data/repositories/ai-usage-repository";
import {
  BudgetedAiProvider,
  type AiPricingConfiguration,
} from "../../src/integrations/openai/budgeted-ai-provider";
import type {
  DiagnosticCategoryCorrection,
  DiagnosticEvent,
  DiagnosticRepositoryPort,
} from "../../src/data/repositories/diagnostic-repository";
import type { FoundationHealthFacts } from "../../src/domain/operations/health";
import type { AiCategoryProposalRouteDependencies } from "../../src/server/api/ai-category-proposal-routes";
import type {
  DiagnosticRouteDependencies,
} from "../../src/server/api/diagnostic-routes";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

const NOW = new Date("2026-07-25T17:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";
const EVENT_ID = "evt_01J0TEST";
const PRICING: AiPricingConfiguration = {
  inputCentsPerMillionTokens: 1_000,
  outputCentsPerMillionTokens: 4_000,
  worstCaseCents: { routine: 10, optional: 20, complex: 50 },
};

function sessionDependencies(authenticated = true) {
  return {
    now: () => NOW,
    sessions: {
      findSession: vi.fn(async (sessionId: string) =>
        authenticated && sessionId === SESSION_ID
          ? {
              ownerId: OWNER_ID,
              googleSubject: "google-subject",
              email: "allowed@example.test",
              csrfToken: CSRF,
              expiresAt: new Date(NOW.getTime() + 600_000),
            }
          : undefined,
      ),
    },
  };
}

function createDiagnosticHarness(options: { authenticated?: boolean } = {}) {
  const repository: DiagnosticRepositoryPort = {
    readFoundationFacts: vi.fn<DiagnosticRepositoryPort["readFoundationFacts"]>(
      async () =>
        ({
          authorizationState: "connected",
          checkpointStatus: "connected",
          lastSuccessfulSyncAt: new Date(NOW.getTime() - 60_000),
          oldestQueuedJobAt: null,
          queueRetryCount: 0,
          failedJobCount: 0,
          channelExpiresAt: new Date(NOW.getTime() + 48 * 60 * 60_000),
          databaseAvailable: true,
          databaseUsageWarning: false,
          r2UsageWarning: false,
          aiMonthlyCents: 950,
          safeErrorCode: null,
          refreshTokenEnvelope: "must-not-leak",
          databaseUrl: "must-not-leak",
        }) as unknown as FoundationHealthFacts,
    ),
    listEvents: vi.fn<DiagnosticRepositoryPort["listEvents"]>(
      async () =>
        [
          {
            id: EVENT_ID,
            title: "Private planning title",
            startsAt: "2026-07-25T17:00:00.000Z",
            endsAt: "2026-07-25T18:00:00.000Z",
            timeZone: "America/Chicago",
            status: "confirmed",
            domain: "work",
            domainState: "inferred",
            categoryProvenance: "model",
            titleEnvelope: "must-not-leak",
            keyVersion: 7,
            providerEventId: "must-not-leak",
          } as unknown as DiagnosticEvent,
        ],
    ),
    correctCategory: vi.fn<DiagnosticRepositoryPort["correctCategory"]>(
      async (eventId, domain, assignedAt) =>
        eventId === EVENT_ID
          ? ({
              id: EVENT_ID,
              domain,
              domainState: "confirmed",
              categoryProvenance: "user",
              assignedAt: assignedAt.toISOString(),
              version: 4,
              providerMutation: "must-not-leak",
            } as unknown as DiagnosticCategoryCorrection)
          : undefined,
    ),
  };
  const repositoryForOwner = vi.fn((ownerId: string) => {
    if (ownerId !== OWNER_ID) throw new Error("wrong owner");
    return repository;
  });
  const dependencies: DiagnosticRouteDependencies = {
    ...sessionDependencies(options.authenticated ?? true),
    repositoryForOwner,
  };
  const app = createApp({
    diagnostic: dependencies,
    createRequestId: () => "req_diagnostics",
    logger: vi.fn(),
  });
  return { app, dependencies, repository, repositoryForOwner };
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://vision.example.test${path}`, {
    ...init,
    headers: {
      cookie: `vision_session=${SESSION_ID}`,
      ...init.headers,
    },
  });
}

describe("Vision Worker diagnostic routes", () => {
  it.each([
    "/api/diagnostics/status",
    "/api/calendar/events",
    "/api/diagnostics/templates",
  ])("requires an active session for GET %s", async (path) => {
    const { app, repositoryForOwner } = createDiagnosticHarness({
      authenticated: false,
    });

    const response = await app.fetch(request(path), {} as Env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
    expect(repositoryForOwner).not.toHaveBeenCalled();
  });

  it("returns timestamped safe health facts without repository extras", async () => {
    const { app } = createDiagnosticHarness();

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {} as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: {
        state: "Healthy",
        authorizationState: "connected",
        lastSuccessfulSyncAt: "2026-07-25T16:59:00.000Z",
        syncDelayMs: 60_000,
        oldestQueuedJobAt: null,
        oldestJobDelayMs: null,
        queueRetryCount: 0,
        failedJobCount: 0,
        channelExpiresAt: "2026-07-27T17:00:00.000Z",
        aiSpendTier: "stopped",
        aiMonthlyCents: 950,
        databaseUsageWarning: false,
        r2UsageWarning: false,
        safeErrorCode: null,
        warningCodes: ["AI_BUDGET_STOPPED"],
      },
    });
  });

  it("uses one freshness timestamp for repository facts and health classification", async () => {
    const { app, dependencies, repository } = createDiagnosticHarness();
    const now = vi
      .fn<DiagnosticRouteDependencies["now"]>()
      .mockReturnValueOnce(NOW)
      .mockReturnValueOnce(NOW)
      .mockReturnValueOnce(new Date(NOW.getTime() + 30 * 60_000));
    (dependencies as { now: DiagnosticRouteDependencies["now"] }).now = now;

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {} as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: { state: "Healthy", syncDelayMs: 60_000 },
    });
    expect(repository.readFoundationFacts).toHaveBeenCalledWith(NOW);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it("returns only authorized event display fields", async () => {
    const { app } = createDiagnosticHarness();

    const response = await app.fetch(
      request("/api/calendar/events"),
      {} as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          id: EVENT_ID,
          title: "Private planning title",
          startsAt: "2026-07-25T17:00:00.000Z",
          endsAt: "2026-07-25T18:00:00.000Z",
          timeZone: "America/Chicago",
          status: "confirmed",
          domain: "work",
          domainState: "inferred",
          categoryProvenance: "model",
        },
      ],
    });
  });

  it("requires CSRF and strict bounded input for category correction", async () => {
    const { app, repository } = createDiagnosticHarness();

    const noCsrf = await app.fetch(
      request(`/api/calendar/events/${EVENT_ID}/category`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: "school" }),
      }),
      {} as Env,
    );
    const extra = await app.fetch(
      request(`/api/calendar/events/${EVENT_ID}/category`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-vision-csrf": CSRF,
        },
        body: JSON.stringify({ domain: "school", mutateGoogle: true }),
      }),
      {} as Env,
    );

    expect(noCsrf.status).toBe(403);
    expect(extra.status).toBe(400);
    expect(repository.correctCategory).not.toHaveBeenCalled();
  });

  it("records an explicit Vision-only category decision and whitelists the result", async () => {
    const { app, repository } = createDiagnosticHarness();

    const response = await app.fetch(
      request(`/api/calendar/events/${EVENT_ID}/category`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-vision-csrf": CSRF,
        },
        body: JSON.stringify({ domain: "school" }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      category: {
        id: EVENT_ID,
        domain: "school",
        domainState: "confirmed",
        categoryProvenance: "user",
        assignedAt: NOW.toISOString(),
        version: 4,
      },
    });
    expect(repository.correctCategory).toHaveBeenCalledWith(
      EVENT_ID,
      "school",
      NOW,
    );
  });

  it("returns deterministic template availability without AI or repository content", async () => {
    const { app } = createDiagnosticHarness();

    const response = await app.fetch(
      request("/api/diagnostics/templates"),
      {} as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      templates: {
        aiUnavailable: true,
        syncDelayed: true,
        actionRequired: true,
        disconnected: true,
      },
    });
  });
});

describe("AI hard-stop Worker survival contract", () => {
  it("keeps all deterministic routes at 200 while AI returns 503 with zero context/provider calls", async () => {
    const diagnostic = createDiagnosticHarness();
    const providerCall = vi.fn();
    const loadCategoryRequest = vi.fn();
    const createContextLoader = vi.fn(() => ({
      load: loadCategoryRequest,
    }));
    const usage: AiUsageRepository = {
      reserve: vi.fn(async () => ({
        status: "denied" as const,
        reason: "budget" as const,
        projectedCents: 950,
      })),
      markDispatched: vi.fn(async () => "dispatched" as const),
      settle: vi.fn(async () => "settled" as const),
      release: vi.fn(async () => "released" as const),
    };
    const ai: AiCategoryProposalRouteDependencies = {
      ...sessionDependencies(),
      createBudgetedProvider: (ownerId) =>
        new BudgetedAiProvider({
          ownerId,
          repository: usage,
          provider: { proposeCategoryResult: providerCall },
          pricing: PRICING,
          reservationTtlMs: 60_000,
          now: () => NOW,
          createReservationId: () =>
            "22222222-2222-4222-8222-222222222222",
        }),
      createContextLoader,
    };
    const app = createApp({
      diagnostic: diagnostic.dependencies,
      aiCategoryProposal: ai,
      createRequestId: () => "req_budget_survival",
      logger: vi.fn(),
    });

    const responses = await Promise.all([
      app.fetch(request("/api/calendar/events"), {} as Env),
      app.fetch(request("/api/diagnostics/status"), {} as Env),
      app.fetch(
        request(`/api/calendar/events/${EVENT_ID}/category`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-vision-csrf": CSRF,
          },
          body: JSON.stringify({ domain: "personal" }),
        }),
        {} as Env,
      ),
      app.fetch(request("/api/diagnostics/templates"), {} as Env),
      app.fetch(
        request("/api/ai/category-proposals", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-vision-csrf": CSRF,
          },
          body: JSON.stringify({
            idempotencyKey: "11111111-1111-4111-8111-111111111111",
            eventId: EVENT_ID,
          }),
        }),
        {} as Env,
      ),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 200, 200, 503,
    ]);
    await expect(responses[4]?.json()).resolves.toMatchObject({
      error: { code: "AI_BUDGET_EXHAUSTED" },
    });
    expect(createContextLoader).not.toHaveBeenCalled();
    expect(loadCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });
});
