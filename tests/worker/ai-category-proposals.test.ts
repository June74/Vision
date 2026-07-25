import { describe, expect, it, vi } from "vitest";
import type { AiUsageRepository } from "../../src/data/repositories/ai-usage-repository";
import type { CategoryProposalRequest } from "../../src/integrations/openai/ai-provider";
import {
  BudgetedAiProvider,
  type AiPricingConfiguration,
} from "../../src/integrations/openai/budgeted-ai-provider";
import type { OpenAiProviderResult } from "../../src/integrations/openai/openai-provider";
import type { AiCategoryProposalRouteDependencies } from "../../src/server/api/ai-category-proposal-routes";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

const NOW = new Date("2026-07-25T17:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";
const REQUEST: CategoryProposalRequest = {
  subjectId: "event-1",
  evidenceIds: ["evidence-1"],
  policyVersion: "category-v1",
  context: {},
};
const BODY = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  event: {
    eventId: "event-1",
    start: "2026-07-25T12:00:00-05:00",
    end: "2026-07-25T13:00:00-05:00",
    allDay: false,
    timeZone: "America/Chicago",
  },
  permissions: {
    policyVersion: "category-v1",
    title: { mode: "omit" },
    evidence: [{ id: "evidence-1", fact: "work meeting" }],
  },
};
const PRICING: AiPricingConfiguration = {
  inputCentsPerMillionTokens: 1_000,
  outputCentsPerMillionTokens: 4_000,
  worstCaseCents: { routine: 10, optional: 20, complex: 50 },
};

function success(): Extract<OpenAiProviderResult, { status: "success" }> {
  return {
    status: "success",
    proposal: {
      domain: "work",
      confidence: 0.9,
      evidenceIds: ["evidence-1"],
      ambiguous: false,
      rationaleCode: "work_context",
      audit: {
        modelId: "gpt-5.6-luna",
        requestId: "response-1",
        policyVersion: "category-v1",
      },
    },
    metadata: {
      requestedModelId: "gpt-5.6-luna",
      modelId: "gpt-5.6-luna",
      requestId: "response-1",
      policyVersion: "category-v1",
      evidenceIds: ["evidence-1"],
      usage: {
        inputTokens: 500,
        outputTokens: 100,
        totalTokens: 600,
        cachedInputTokens: 0,
        reasoningOutputTokens: 0,
      },
    },
  };
}

function createHarness(options: {
  authenticated?: boolean;
  reserve?: AiUsageRepository["reserve"];
} = {}) {
  const providerCall = vi.fn(async () => success());
  const buildCategoryRequest = vi.fn(() => REQUEST);
  const reserve =
    options.reserve ??
    vi.fn<AiUsageRepository["reserve"]>(async () => ({
      status: "denied",
      reason: "budget",
      projectedCents: 950,
    }));
  const repository: AiUsageRepository = {
    reserve,
    markDispatched: vi.fn<AiUsageRepository["markDispatched"]>(
      async () => "dispatched",
    ),
    settle: vi.fn<AiUsageRepository["settle"]>(async () => "settled"),
    release: vi.fn<AiUsageRepository["release"]>(async () => "released"),
  };
  const createBudgetedProvider = vi.fn(
    (ownerId: string) =>
      new BudgetedAiProvider({
        ownerId,
        repository,
        provider: { proposeCategoryResult: providerCall },
        pricing: PRICING,
        reservationTtlMs: 60_000,
        now: () => NOW,
        createReservationId: () =>
          "22222222-2222-4222-8222-222222222222",
      }),
  );
  const dependencies: AiCategoryProposalRouteDependencies = {
    now: () => NOW,
    sessions: {
      findSession: vi.fn(async (sessionId) =>
        options.authenticated === false || sessionId !== SESSION_ID
          ? undefined
          : {
              ownerId: OWNER_ID,
              googleSubject: "google-subject",
              email: "allowed@example.test",
              csrfToken: CSRF,
              expiresAt: new Date(NOW.getTime() + 600_000),
            },
      ),
    },
    createBudgetedProvider,
    buildCategoryRequest,
  };
  const app = createApp({
    aiCategoryProposal: dependencies,
    createRequestId: () => "req_ai_category",
    logger: vi.fn(),
  });
  return {
    app,
    providerCall,
    buildCategoryRequest,
    createBudgetedProvider,
    repository,
  };
}

function post(
  body: BodyInit = JSON.stringify(BODY),
  headers: HeadersInit = {},
): Request {
  return new Request(
    "https://vision.example.test/api/ai/category-proposals",
    {
      method: "POST",
      headers: {
        cookie: `vision_session=${SESSION_ID}`,
        "content-type": "application/json",
        "x-vision-csrf": CSRF,
        ...headers,
      },
      body,
    },
  );
}

describe("Vision Worker AI category proposal route", () => {
  it("returns a safe 503 at 950 before context construction or provider dispatch", async () => {
    const { app, providerCall, buildCategoryRequest, createBudgetedProvider } =
      createHarness();

    const response = await app.fetch(post(), {} as Env);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AI_BUDGET_EXHAUSTED",
        message: "AI proposal is unavailable because the monthly budget is exhausted.",
        requestId: "req_ai_category",
      },
    });
    expect(createBudgetedProvider).toHaveBeenCalledWith(OWNER_ID);
    expect(buildCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("requires an active server session before parsing input", async () => {
    const { app, providerCall, buildCategoryRequest } = createHarness({
      authenticated: false,
    });

    const response = await app.fetch(post("{"), {} as Env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
    expect(buildCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("requires the exact session CSRF token before parsing input", async () => {
    const { app, providerCall, buildCategoryRequest } = createHarness();

    const response = await app.fetch(
      post("{", { "x-vision-csrf": "X".repeat(43) }),
      {} as Env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CSRF_VALIDATION_FAILED" },
    });
    expect(buildCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it.each([
    [
      "wrong content type",
      JSON.stringify(BODY),
      { "content-type": "text/plain" },
    ],
    ["malformed JSON", "{", {}],
    [
      "unknown outer field",
      JSON.stringify({ ...BODY, requestClass: "complex" }),
      {},
    ],
    [
      "missing required event",
      JSON.stringify({
        idempotencyKey: BODY.idempotencyKey,
        permissions: BODY.permissions,
      }),
      {},
    ],
    ["oversized body", `"${"x".repeat(32 * 1_024)}"`, {}],
  ])(
    "rejects %s before context construction or provider dispatch",
    async (_label, body, headers) => {
      const { app, providerCall, buildCategoryRequest } = createHarness();

      const response = await app.fetch(post(body, headers), {} as Env);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_AI_CATEGORY_REQUEST" },
      });
      expect(buildCategoryRequest).not.toHaveBeenCalled();
      expect(providerCall).not.toHaveBeenCalled();
    },
  );

  it("uses the budgeted provider and returns only the validated proposal on success", async () => {
    const { app, providerCall, buildCategoryRequest } = createHarness({
      reserve: vi.fn<AiUsageRepository["reserve"]>(async () => ({
        status: "reserved",
        reservationId: "22222222-2222-4222-8222-222222222222",
        budgetMonth: "2026-07",
        projectedCents: 10,
      })),
    });

    const response = await app.fetch(post(), {} as Env);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      proposal: success().proposal,
    });
    expect(buildCategoryRequest).toHaveBeenCalledOnce();
    expect(providerCall).toHaveBeenCalledWith(REQUEST);
  });
});
