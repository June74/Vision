import { describe, expect, it, vi } from "vitest";
import type { AiUsageRepository } from "../../src/data/repositories/ai-usage-repository";
import type { PlaintextEvent } from "../../src/data/repositories/event-repository";
import { ProviderOrderKeySchema } from "../../src/domain/events/event";
import type { CategoryProposalRequest } from "../../src/integrations/openai/ai-provider";
import {
  BudgetedAiProvider,
  type AiPricingConfiguration,
} from "../../src/integrations/openai/budgeted-ai-provider";
import type { OpenAiProviderResult } from "../../src/integrations/openai/openai-provider";
import type { AiCategoryProposalRouteDependencies } from "../../src/server/api/ai-category-proposal-routes";
import { createAiCategoryContextLoader } from "../../src/server/ai/category-context-loader";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

const NOW = new Date("2026-07-25T17:00:00.000Z");
const SESSION_ID = "S".repeat(43);
const CSRF = "C".repeat(43);
const OWNER_ID = "usr_private_pilot";
const CALLER_SENTINEL = "CALLER_PRIVATE_SENTINEL_MUST_NOT_REACH_PROVIDER";
const TRUSTED_PRIVATE_SENTINEL =
  "TRUSTED_DESCRIPTION_SENTINEL_MUST_NOT_REACH_PROVIDER";
const REQUEST: CategoryProposalRequest = {
  subjectId: "event-1",
  evidenceIds: ["event-status"],
  policyVersion: "ai-category-v1",
  context: {
    eventId: "event-1",
    title: { mode: "plaintext", value: "Trusted planning review" },
    schedule: {
      start: "2026-07-25T17:00:00.000Z",
      end: "2026-07-25T18:00:00.000Z",
      allDay: false,
      timeZone: "America/Chicago",
    },
    evidence: [{ id: "event-status", fact: "status confirmed busy yes" }],
    policyVersion: "ai-category-v1",
  },
};
const BODY = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  eventId: "event-1",
};
const TRUSTED_EVENT: PlaintextEvent = {
  nodeId: "event-1",
  ownerId: OWNER_ID,
  identity: {
    sourceSystem: "google-calendar",
    sourceCalendarId: "vision-calendar",
    sourceEventId: "provider-event-1",
    sourceVersion: ProviderOrderKeySchema.parse("00000000000000000001"),
  },
  startsAt: "2026-07-25T17:00:00.000Z",
  endsAt: "2026-07-25T18:00:00.000Z",
  timeZone: "America/Chicago",
  busy: true,
  status: "confirmed",
  domain: "work",
  domainState: "confirmed",
  privacy: "private",
  version: 1,
  title: "Trusted planning review",
  description: TRUSTED_PRIVATE_SENTINEL,
  attendees: [`person:${TRUSTED_PRIVATE_SENTINEL}`],
  location: TRUSTED_PRIVATE_SENTINEL,
  meetingLink: `https://example.invalid/${TRUSTED_PRIVATE_SENTINEL}`,
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
      evidenceIds: ["event-status"],
      ambiguous: false,
      rationaleCode: "work_context",
      audit: {
        modelId: "gpt-5.6-luna",
        requestId: "response-1",
        policyVersion: "ai-category-v1",
      },
    },
    metadata: {
      requestedModelId: "gpt-5.6-luna",
      modelId: "gpt-5.6-luna",
      requestId: "response-1",
      policyVersion: "ai-category-v1",
      evidenceIds: ["event-status"],
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
  eventAvailable?: boolean;
  reserve?: AiUsageRepository["reserve"];
} = {}) {
  const providerCall = vi.fn(async () => success());
  const eventGet = vi.fn(async () =>
    options.eventAvailable === false ? undefined : TRUSTED_EVENT,
  );
  const trustedLoader = createAiCategoryContextLoader({ get: eventGet });
  const loadCategoryRequest = vi.fn((eventId: string) =>
    trustedLoader.load(eventId),
  );
  const createContextLoader = vi.fn((ownerId: string) => {
    expect(ownerId).toBe(OWNER_ID);
    return { load: loadCategoryRequest };
  });
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
    createContextLoader,
  };
  const app = createApp({
    aiCategoryProposal: dependencies,
    createRequestId: () => "req_ai_category",
    logger: vi.fn(),
  });
  return {
    app,
    providerCall,
    loadCategoryRequest,
    createContextLoader,
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
    const {
      app,
      providerCall,
      loadCategoryRequest,
      createContextLoader,
      createBudgetedProvider,
    } =
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
    expect(createContextLoader).not.toHaveBeenCalled();
    expect(loadCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("requires an active server session before parsing input", async () => {
    const { app, providerCall, loadCategoryRequest } = createHarness({
      authenticated: false,
    });

    const response = await app.fetch(post("{"), {} as Env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
    expect(loadCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("requires the exact session CSRF token before parsing input", async () => {
    const { app, providerCall, loadCategoryRequest } = createHarness();

    const response = await app.fetch(
      post("{", { "x-vision-csrf": "X".repeat(43) }),
      {} as Env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "CSRF_VALIDATION_FAILED" },
    });
    expect(loadCategoryRequest).not.toHaveBeenCalled();
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
      "missing required event reference",
      JSON.stringify({
        idempotencyKey: BODY.idempotencyKey,
      }),
      {},
    ],
    ["oversized body", `"${"x".repeat(32 * 1_024)}"`, {}],
  ])(
    "rejects %s before context construction or provider dispatch",
    async (_label, body, headers) => {
      const { app, providerCall, loadCategoryRequest } = createHarness();

      const response = await app.fetch(post(body, headers), {} as Env);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_AI_CATEGORY_REQUEST" },
      });
      expect(loadCategoryRequest).not.toHaveBeenCalled();
      expect(providerCall).not.toHaveBeenCalled();
    },
  );

  it("rejects client-supplied plaintext and evidence without forwarding sentinels", async () => {
    const { app, providerCall, loadCategoryRequest } = createHarness();

    const response = await app.fetch(
      post(
        JSON.stringify({
          ...BODY,
          title: CALLER_SENTINEL,
          evidence: [{ id: "caller-evidence", fact: CALLER_SENTINEL }],
          permissions: {
            title: { mode: "plaintext" },
            evidence: [{ id: "caller-evidence", fact: CALLER_SENTINEL }],
          },
        }),
      ),
      {} as Env,
    );

    expect(response.status).toBe(400);
    expect(loadCategoryRequest).not.toHaveBeenCalled();
    expect(providerCall).not.toHaveBeenCalled();
    expect(JSON.stringify(providerCall.mock.calls)).not.toContain(
      CALLER_SENTINEL,
    );
  });

  it("does not disclose a missing or cross-owner event reference", async () => {
    const { app, providerCall, loadCategoryRequest } = createHarness({
      eventAvailable: false,
      reserve: vi.fn<AiUsageRepository["reserve"]>(async () => ({
        status: "reserved",
        reservationId: "22222222-2222-4222-8222-222222222222",
        budgetMonth: "2026-07",
        projectedCents: 10,
      })),
    });

    const response = await app.fetch(
      post(JSON.stringify({ ...BODY, eventId: "event-owned-by-someone-else" })),
      {} as Env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AI_EVENT_NOT_AVAILABLE" },
    });
    expect(loadCategoryRequest).toHaveBeenCalledWith(
      "event-owned-by-someone-else",
    );
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("loads trusted same-owner facts after admission and forwards only the minimized packet", async () => {
    const { app, providerCall, loadCategoryRequest } = createHarness({
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
    expect(loadCategoryRequest).toHaveBeenCalledWith("event-1");
    expect(providerCall).toHaveBeenCalledWith(REQUEST);
    expect(JSON.stringify(providerCall.mock.calls)).not.toContain(
      CALLER_SENTINEL,
    );
    expect(JSON.stringify(providerCall.mock.calls)).not.toContain(
      TRUSTED_PRIVATE_SENTINEL,
    );
  });
});
