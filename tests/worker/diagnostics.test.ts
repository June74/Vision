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

function sessionDependencies(
  authenticated = true,
  ownerId = OWNER_ID,
) {
  return {
    now: () => NOW,
    sessions: {
      findSession: vi.fn(async (sessionId: string) =>
        authenticated && sessionId === SESSION_ID
          ? {
              ownerId,
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

function createDiagnosticHarness(
  options: {
    authenticated?: boolean;
    activeRequestCount?: number;
    createdRequestCount?: number;
    eligibleSettledRequestCount?: number;
    databaseUsageWarning?: boolean;
    r2UsageWarning?: boolean;
    aiMonthlyCents?: number;
    sessionOwnerId?: string;
  } = {},
) {
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
          databaseUsageWarning: options.databaseUsageWarning ?? false,
          r2UsageWarning: options.r2UsageWarning ?? false,
          aiMonthlyCents: options.aiMonthlyCents ?? 950,
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
  const countActiveRequests = vi.fn(
    async () => options.activeRequestCount ?? 0,
  );
  const readCandidateRequestCounts = vi.fn(async () =>
    ({
      createdRequestCount: options.createdRequestCount ?? 1,
      eligibleSettledRequestCount:
        options.eligibleSettledRequestCount ?? 1,
      reservationId: "must-not-leak",
      idempotencyKey: "must-not-leak",
      model: "must-not-leak",
      providerRequestId: "must-not-leak",
      tokenCount: 9_999,
      prompt: "must-not-leak",
      response: "must-not-leak",
      rows: ["must-not-leak"],
    }) as never,
  );
  const aiUsageSourceForOwner = vi.fn((ownerId: string) => {
    if (ownerId !== OWNER_ID) throw new Error("wrong owner");
    return { countActiveRequests, readCandidateRequestCounts };
  });
  const dependencies: DiagnosticRouteDependencies = {
    ...sessionDependencies(
      options.authenticated ?? true,
      options.sessionOwnerId ?? OWNER_ID,
    ),
    repositoryForOwner,
    aiUsageSourceForOwner,
  };
  const app = createApp({
    diagnostic: dependencies,
    createRequestId: () => "req_diagnostics",
    logger: vi.fn(),
  });
  return {
    app,
    dependencies,
    repository,
    repositoryForOwner,
    aiUsageSourceForOwner,
    countActiveRequests,
    readCandidateRequestCounts,
  };
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

  it("maps production diagnostic initialization failure to the constant safe boundary", async () => {
    const logger = vi.fn();
    const app = createApp({
      createRequestId: () => "req_diagnostic_init",
      logger,
    });

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {} as Env,
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(JSON.parse(serialized)).toEqual({
      error: {
        code: "DIAGNOSTICS_UNAVAILABLE",
        message: "Foundation diagnostics are temporarily unavailable.",
        requestId: "req_diagnostic_init",
      },
    });
    expect(serialized).not.toMatch(
      /DATABASE_URL|BACKUP_BUCKET|R2_USAGE|credential|provider/iu,
    );
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

  it("returns only the active aggregate in normal preview diagnostics", async () => {
    const {
      app,
      aiUsageSourceForOwner,
      countActiveRequests,
      readCandidateRequestCounts,
    } = createDiagnosticHarness({ activeRequestCount: 2 });

    const response = await app.fetch(request("/api/diagnostics/status"), {
      VISION_ENV: "preview",
    } as Env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      aiAcceptance: {
        activeRequestCount: 2,
        createdRequestCount: null,
        eligibleSettledRequestCount: null,
        evidenceScheduledAt: null,
      },
    });
    expect(aiUsageSourceForOwner).toHaveBeenCalledOnce();
    expect(aiUsageSourceForOwner).toHaveBeenCalledWith(OWNER_ID);
    expect(countActiveRequests).toHaveBeenCalledOnce();
    expect(readCandidateRequestCounts).not.toHaveBeenCalled();
  });

  it("returns one allowlisted atomic candidate aggregate only for ai_usage", async () => {
    const {
      app,
      countActiveRequests,
      readCandidateRequestCounts,
    } = createDiagnosticHarness({
      activeRequestCount: 0,
      createdRequestCount: 1,
      eligibleSettledRequestCount: 1,
    });
    const evidenceScheduledAt = "2026-07-25T17:15:00.000Z";
    const response = await app.fetch(request("/api/diagnostics/status"), {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-25T17:15:30.000Z",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: evidenceScheduledAt,
      PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
    } as Env);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      aiAcceptance: {
        activeRequestCount: 0,
        createdRequestCount: 1,
        eligibleSettledRequestCount: 1,
        evidenceScheduledAt,
      },
    });
    expect(Object.keys((payload as { aiAcceptance: object }).aiAcceptance)).toEqual([
      "activeRequestCount",
      "createdRequestCount",
      "eligibleSettledRequestCount",
      "evidenceScheduledAt",
    ]);
    expect(countActiveRequests).toHaveBeenCalledOnce();
    expect(readCandidateRequestCounts).toHaveBeenCalledOnce();
    expect(JSON.stringify(payload)).not.toMatch(
      /reservationId|idempotencyKey|model|providerRequestId|tokenCount|prompt|response|rows|must-not-leak/u,
    );
  });

  it("omits AI acceptance and performs no aggregate work outside preview", async () => {
    const {
      app,
      aiUsageSourceForOwner,
      countActiveRequests,
      readCandidateRequestCounts,
    } = createDiagnosticHarness();

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      { VISION_ENV: "production" } as Env,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).not.toHaveProperty("aiAcceptance");
    expect(aiUsageSourceForOwner).not.toHaveBeenCalled();
    expect(countActiveRequests).not.toHaveBeenCalled();
    expect(readCandidateRequestCounts).not.toHaveBeenCalled();
  });

  it("performs zero aggregate work for unauthenticated and wrong-owner preview requests", async () => {
    for (const options of [
      { authenticated: false },
      { sessionOwnerId: "usr_not_the_private_pilot" },
    ]) {
      const {
        app,
        aiUsageSourceForOwner,
        countActiveRequests,
        readCandidateRequestCounts,
      } = createDiagnosticHarness(options);
      await app.fetch(request("/api/diagnostics/status"), {
        VISION_ENV: "preview",
      } as Env);

      expect(aiUsageSourceForOwner).not.toHaveBeenCalled();
      expect(countActiveRequests).not.toHaveBeenCalled();
      expect(readCandidateRequestCounts).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      "queue_delayed",
      {
        state: "Delayed",
        oldestQueuedJobAt: "2026-07-25T16:45:00.000Z",
        oldestJobDelayMs: 900_000,
        warningCodes: ["QUEUE_DELAYED"],
      },
    ],
    [
      "job_failed",
      {
        state: "Action required",
        failedJobCount: 1,
        warningCodes: ["FAILED_JOBS"],
      },
    ],
    [
      "channel_expired",
      {
        state: "Action required",
        channelExpiresAt: "2026-07-25T16:59:59.999Z",
        warningCodes: ["CHANNEL_EXPIRED"],
      },
    ],
    [
      "database_unavailable",
      {
        state: "Action required",
        warningCodes: ["DATABASE_UNAVAILABLE"],
      },
    ],
    [
      "ai_stopped",
      {
        state: "Healthy",
        aiSpendTier: "stopped",
        aiMonthlyCents: 950,
        warningCodes: ["AI_BUDGET_STOPPED"],
      },
    ],
  ] as const)(
    "applies the authenticated %s preview overlay through the exact public response",
    async (scenario, expectedOverrides) => {
      const { app, repository } = createDiagnosticHarness({ aiMonthlyCents: 0 });

      const response = await app.fetch(
        request("/api/diagnostics/status"),
        {
          VISION_ENV: "preview",
          PREVIEW_ACCEPTANCE_SCENARIO: scenario,
        } as Env,
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({
        status: {
          authorizationState: "connected",
          lastSuccessfulSyncAt: "2026-07-25T16:59:00.000Z",
          syncDelayMs: 60_000,
          oldestQueuedJobAt: null,
          oldestJobDelayMs: null,
          queueRetryCount: 0,
          failedJobCount: 0,
          channelExpiresAt: "2026-07-27T17:00:00.000Z",
          aiSpendTier: "normal",
          aiMonthlyCents: 0,
          databaseUsageWarning: false,
          r2UsageWarning: false,
          safeErrorCode: null,
          ...expectedOverrides,
        },
        aiAcceptance: {
          activeRequestCount: 0,
          createdRequestCount: null,
          eligibleSettledRequestCount: null,
          evidenceScheduledAt: null,
        },
      });
      expect(JSON.stringify(payload)).not.toMatch(
        /queue_delayed|job_failed|channel_expired|database_unavailable|r2_upload_failed|ai_stopped|PREVIEW_ACCEPTANCE_SCENARIO|vision\.preview-fault/u,
      );
      expect(repository.readFoundationFacts).toHaveBeenCalledOnce();
    },
  );

  it("rejects an unauthenticated fault request before repository facts or overlay use", async () => {
    const { app, repository } = createDiagnosticHarness({ authenticated: false });

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "job_failed",
      } as Env,
    );

    expect(response.status).toBe(401);
    expect(repository.readFoundationFacts).not.toHaveBeenCalled();
  });

  it("rejects a wrong-owner session before reading or overlaying foundation facts", async () => {
    const { app, repository, repositoryForOwner } = createDiagnosticHarness({
      aiMonthlyCents: 0,
      sessionOwnerId: "usr_not_the_private_pilot",
    });

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "job_failed",
      } as Env,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
    expect(repositoryForOwner).toHaveBeenCalledWith(
      "usr_not_the_private_pilot",
    );
    expect(repository.readFoundationFacts).not.toHaveBeenCalled();
  });

  it.each([
    [
      "query",
      request("/api/diagnostics/status?PREVIEW_ACCEPTANCE_SCENARIO=job_failed"),
    ],
    [
      "header",
      request("/api/diagnostics/status", {
        headers: { PREVIEW_ACCEPTANCE_SCENARIO: "job_failed" },
      }),
    ],
    [
      "cookie",
      request("/api/diagnostics/status", {
        headers: {
          cookie:
            `vision_session=${SESSION_ID}; PREVIEW_ACCEPTANCE_SCENARIO=job_failed`,
        },
      }),
    ],
  ])(
    "does not activate the preview scenario from an HTTP %s",
    async (_source, candidateRequest) => {
      const { app } = createDiagnosticHarness({ aiMonthlyCents: 0 });

      const response = await app.fetch(candidateRequest, { VISION_ENV: "preview" } as Env);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        status: {
          state: "Healthy",
          failedJobCount: 0,
          aiMonthlyCents: 0,
        },
      });
      expect(JSON.stringify(payload)).not.toMatch(/job_failed|PREVIEW_ACCEPTANCE_SCENARIO/u);
    },
  );

  it.each([
    ["route", request("/api/diagnostics/status/job_failed")],
    [
      "body",
      request("/api/diagnostics/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ PREVIEW_ACCEPTANCE_SCENARIO: "job_failed" }),
      }),
    ],
  ])(
    "does not activate the preview scenario from an HTTP %s on an unregistered route",
    async (_source, candidateRequest) => {
      const { app, repository } = createDiagnosticHarness({ aiMonthlyCents: 0 });

      const response = await app.fetch(candidateRequest, { VISION_ENV: "preview" } as Env);

      expect(response.status).toBe(404);
      expect(repository.readFoundationFacts).not.toHaveBeenCalled();
    },
  );

  it.each(["queueMessage", "databaseRow", "modelOutput"])(
    "does not activate the preview scenario from nested %s data at the Worker binding boundary",
    async (source) => {
      const { app } = createDiagnosticHarness({ aiMonthlyCents: 0 });

      const response = await app.fetch(
        request("/api/diagnostics/status"),
        {
          VISION_ENV: "preview",
          [source]: { PREVIEW_ACCEPTANCE_SCENARIO: "job_failed" },
        } as unknown as Env,
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        status: {
          state: "Healthy",
          failedJobCount: 0,
          aiMonthlyCents: 0,
        },
      });
      expect(JSON.stringify(payload)).not.toMatch(/job_failed|PREVIEW_ACCEPTANCE_SCENARIO/u);
    },
  );

  it("leaves authenticated calendar reads unchanged for the R2-only scenario", async () => {
    const { app, repository } = createDiagnosticHarness({ aiMonthlyCents: 0 });
    const environment = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "r2_upload_failed",
    } as Env;

    const [statusResponse, eventsResponse] = await Promise.all([
      app.fetch(request("/api/diagnostics/status"), environment),
      app.fetch(request("/api/calendar/events"), environment),
    ]);

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toEqual({
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
        aiSpendTier: "normal",
        aiMonthlyCents: 0,
        databaseUsageWarning: false,
        r2UsageWarning: false,
        safeErrorCode: null,
        warningCodes: [],
      },
      aiAcceptance: {
        activeRequestCount: 0,
        createdRequestCount: null,
        eligibleSettledRequestCount: null,
        evidenceScheduledAt: null,
      },
    });
    expect(eventsResponse.status).toBe(200);
    await expect(eventsResponse.json()).resolves.toEqual({
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
    expect(repository.correctCategory).not.toHaveBeenCalled();
  });

  it("preserves the exact public shape when measured storage warnings are actionable", async () => {
    const { app } = createDiagnosticHarness({
      databaseUsageWarning: true,
      r2UsageWarning: true,
    });

    const response = await app.fetch(
      request("/api/diagnostics/status"),
      {} as Env,
    );
    const payload = await response.json() as {
      status: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(payload.status.databaseUsageWarning).toBe(true);
    expect(payload.status.r2UsageWarning).toBe(true);
    expect(Object.keys(payload.status).sort()).toEqual([
      "aiMonthlyCents",
      "aiSpendTier",
      "authorizationState",
      "channelExpiresAt",
      "databaseUsageWarning",
      "failedJobCount",
      "lastSuccessfulSyncAt",
      "oldestJobDelayMs",
      "oldestQueuedJobAt",
      "queueRetryCount",
      "r2UsageWarning",
      "safeErrorCode",
      "state",
      "syncDelayMs",
      "warningCodes",
    ]);
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
  it("enforces the admitted ai_stopped candidate before reservation, context, or provider work", async () => {
    const diagnostic = createDiagnosticHarness({ aiMonthlyCents: 0 });
    const providerCall = vi.fn();
    const loadCategoryRequest = vi.fn();
    const createContextLoader = vi.fn(() => ({
      load: loadCategoryRequest,
    }));
    const reserve = vi.fn<AiUsageRepository["reserve"]>(async () => ({
      status: "reserved" as const,
      reservationId: "22222222-2222-4222-8222-222222222222",
      budgetMonth: "2026-07",
      projectedCents: 10,
    }));
    const usage: AiUsageRepository = {
      reserve,
      markDispatched: vi.fn(async () => "dispatched" as const),
      settle: vi.fn(async () => "settled" as const),
      release: vi.fn(async () => "released" as const),
    };
    const createBudgetedProvider = vi.fn((ownerId: string) =>
      new BudgetedAiProvider({
        ownerId,
        repository: usage,
        provider: { proposeCategoryResult: providerCall },
        pricing: PRICING,
        reservationTtlMs: 60_000,
        now: () => NOW,
        createReservationId: () =>
          "22222222-2222-4222-8222-222222222222",
      }));
    const app = createApp({
      diagnostic: diagnostic.dependencies,
      aiCategoryProposal: {
        ...sessionDependencies(),
        createBudgetedProvider,
        createContextLoader,
      },
      createRequestId: () => "req_candidate_ai_stop",
      logger: vi.fn(),
    });
    const environment = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_stopped",
    } as Env;

    const responses = await Promise.all([
      app.fetch(request("/api/calendar/events"), environment),
      app.fetch(request("/api/diagnostics/status"), environment),
      app.fetch(
        request(`/api/calendar/events/${EVENT_ID}/category`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-vision-csrf": CSRF,
          },
          body: JSON.stringify({ domain: "personal" }),
        }),
        environment,
      ),
      app.fetch(request("/api/diagnostics/templates"), environment),
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
        environment,
      ),
    ]);
    const payloads = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(createBudgetedProvider).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    expect(createContextLoader).not.toHaveBeenCalled();
    expect(loadCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 200, 200, 503,
    ]);
    expect(payloads[0]).toMatchObject({
      events: [expect.objectContaining({ id: EVENT_ID })],
    });
    expect(payloads[1]).toMatchObject({
      status: {
        state: "Healthy",
        aiSpendTier: "stopped",
        aiMonthlyCents: 950,
      },
    });
    expect(payloads[4]).toEqual({
      error: {
        code: "AI_BUDGET_EXHAUSTED",
        message:
          "AI proposal is unavailable because the monthly budget is exhausted.",
        requestId: "req_candidate_ai_stop",
      },
    });
    expect(JSON.stringify(payloads)).not.toMatch(
      /ai_stopped|PREVIEW_ACCEPTANCE_SCENARIO|vision\.preview-fault/u,
    );
  });

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
