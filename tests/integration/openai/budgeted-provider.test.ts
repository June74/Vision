import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createAiUsageRepository,
  type AiUsageRepository,
} from "../../../src/data/repositories/ai-usage-repository";
import {
  BudgetedAiProvider,
  type AiPricingConfiguration,
} from "../../../src/integrations/openai/budgeted-ai-provider";
import {
  MAX_OPENAI_PROVIDER_TIMEOUT_MS,
  type OpenAiProviderResult,
  type OpenAiUsageMetadata,
} from "../../../src/integrations/openai/openai-provider";

const OWNER_ID = "owner-1";
const NOW = new Date("2026-07-25T17:00:00.000Z");
const REQUEST = {
  subjectId: "event-1",
  evidenceIds: ["evidence-1"],
  policyVersion: "category-v1",
  context: {},
};
const USAGE: OpenAiUsageMetadata = {
  inputTokens: 500,
  outputTokens: 100,
  totalTokens: 600,
  cachedInputTokens: 0,
  reasoningOutputTokens: 0,
};
const PRICING: AiPricingConfiguration = {
  inputCentsPerMillionTokens: 1_000,
  outputCentsPerMillionTokens: 4_000,
  worstCaseCents: {
    routine: 10,
    optional: 20,
    complex: 50,
  },
};

let pglite: PGlite;
let repository: AiUsageRepository;

beforeEach(async () => {
  pglite = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
    "0005_google_notification_jobs.sql",
    "0006_google_channel_lifecycle.sql",
    "0007_calendar_maintenance_state.sql",
    "0008_google_projection_rebuild.sql",
    "0009_ai_usage_budget.sql",
  ]) {
    await pglite.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  repository = createAiUsageRepository(
    drizzle(pglite) as unknown as VisionDatabase,
  );
});

afterEach(async () => {
  await pglite.close();
});

function success(usage = USAGE): OpenAiProviderResult {
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
      usage,
    },
  };
}

function createProvider(
  providerResult: OpenAiProviderResult | (() => Promise<OpenAiProviderResult>) =
    success(),
  now = () => NOW,
) {
  const proposeCategoryResult = vi.fn(
    typeof providerResult === "function"
      ? providerResult
      : async () => providerResult,
  );
  const budgeted = new BudgetedAiProvider({
    ownerId: OWNER_ID,
    repository,
    provider: { proposeCategoryResult },
    pricing: PRICING,
    reservationTtlMs: 60_000,
    now,
    createReservationId: () => crypto.randomUUID(),
  });
  return { budgeted, proposeCategoryResult };
}

async function monthlyUsage(month = "2026-07") {
  return (
    await pglite.query(
      `select settled_cents, reserved_cents
       from ai_usage_months
       where owner_id = $1 and budget_month = $2`,
      [OWNER_ID, month],
    )
  ).rows;
}

describe("BudgetedAiProvider", () => {
  it("reserves before dispatch and settles actual safe usage metadata", async () => {
    const { budgeted, proposeCategoryResult } = createProvider();

    const result = await budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "operation-1",
    });

    expect(result.status).toBe("success");
    expect(proposeCategoryResult).toHaveBeenCalledOnce();
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 1, reserved_cents: 0 },
    ]);
    expect(
      (
        await pglite.query(
          `select status, estimated_cents, actual_cents, provider_request_id,
                  input_tokens, output_tokens
           from ai_usage_reservations`,
        )
      ).rows,
    ).toEqual([
      {
        status: "settled",
        estimated_cents: 10,
        actual_cents: 1,
        provider_request_id: "response-1",
        input_tokens: 500,
        output_tokens: 100,
      },
    ]);
  });

  it("blocks a new reservation that would cross 950 cents without calling the provider", async () => {
    await pglite.query(
      `insert into ai_usage_months (
         owner_id, budget_month, settled_cents, reserved_cents, created_at, updated_at
       ) values ($1, '2026-07', 941, 0, $2, $2)`,
      [OWNER_ID, NOW.toISOString()],
    );
    const { budgeted, proposeCategoryResult } = createProvider();

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "operation-crosses-limit",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_BUDGET_EXHAUSTED",
      mode: "blocked",
    });
    expect(proposeCategoryResult).not.toHaveBeenCalled();
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 941, reserved_cents: 0 },
    ]);
  });

  it("does not build provider context until after budget admission", async () => {
    await pglite.query(
      `insert into ai_usage_months (
         owner_id, budget_month, settled_cents, reserved_cents, created_at, updated_at
       ) values ($1, '2026-07', 950, 0, $2, $2)`,
      [OWNER_ID, NOW.toISOString()],
    );
    const { budgeted, proposeCategoryResult } = createProvider();
    const requestFactory = vi.fn(() => REQUEST);

    await expect(
      budgeted.proposeCategoryFromFactory({
        requestFactory,
        requestClass: "routine",
        idempotencyKey: "operation-lazy-context",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_BUDGET_EXHAUSTED",
      mode: "blocked",
    });
    expect(requestFactory).not.toHaveBeenCalled();
    expect(proposeCategoryResult).not.toHaveBeenCalled();
  });

  it("awaits trusted asynchronous context loading after admission", async () => {
    const { budgeted, proposeCategoryResult } = createProvider();
    const requestFactory = vi.fn(async () => REQUEST);

    await expect(
      budgeted.proposeCategoryFromFactory({
        requestFactory,
        requestClass: "routine",
        idempotencyKey: "operation-async-context",
      }),
    ).resolves.toMatchObject({ status: "success" });
    expect(requestFactory).toHaveBeenCalledOnce();
    expect(proposeCategoryResult).toHaveBeenCalledWith(REQUEST);
  });

  it("rejects dispatch at the exact reservation-expiry boundary", async () => {
    const expiresAt = new Date(NOW.getTime() + 60_000);
    await repository.reserve({
      reservationId: "reservation-exact-expiry",
      ownerId: OWNER_ID,
      idempotencyKey: "operation-exact-expiry",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt,
    });

    await expect(
      repository.markDispatched(
        "reservation-exact-expiry",
        OWNER_ID,
        expiresAt,
        new Date(expiresAt.getTime() + 60_000),
      ),
    ).rejects.toThrow("AI reservation cannot be dispatched.");
  });

  it("atomically refreshes an unexpired reservation lease at dispatch", async () => {
    const originalExpiry = new Date(NOW.getTime() + 60_000);
    const dispatchedAt = new Date(NOW.getTime() + 1_000);
    const dispatchExpiry = new Date(dispatchedAt.getTime() + 60_000);
    await repository.reserve({
      reservationId: "reservation-refresh-dispatch",
      ownerId: OWNER_ID,
      idempotencyKey: "operation-refresh-dispatch",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt: originalExpiry,
    });

    await repository.markDispatched(
      "reservation-refresh-dispatch",
      OWNER_ID,
      dispatchedAt,
      dispatchExpiry,
    );

    expect(
      (
        await pglite.query(
          `select status, dispatched_at, expires_at
           from ai_usage_reservations
           where id = 'reservation-refresh-dispatch'`,
        )
      ).rows,
    ).toEqual([
      {
        status: "dispatched",
        dispatched_at: dispatchedAt,
        expires_at: dispatchExpiry,
      },
    ]);
  });

  it("does not dispatch when protected context loading consumes the reservation lease", async () => {
    let clock = NOW;
    let releaseContext!: () => void;
    const contextBlocked = new Promise<void>((resolve) => {
      releaseContext = resolve;
    });
    let contextEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      contextEntered = resolve;
    });
    let releaseExpiredProvider!: () => void;
    const expiredProviderBlocked = new Promise<void>((resolve) => {
      releaseExpiredProvider = resolve;
    });
    let expiredProviderEntered!: () => void;
    const expiredProviderEntry = new Promise<void>((resolve) => {
      expiredProviderEntered = resolve;
    });
    let expiredProviderActive = false;
    const expiredProviderCall = vi.fn(async () => {
      expiredProviderActive = true;
      expiredProviderEntered();
      await expiredProviderBlocked;
      expiredProviderActive = false;
      return success();
    });
    const expiredRequest = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository,
      provider: { proposeCategoryResult: expiredProviderCall },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => clock,
      createReservationId: () => "reservation-context-expired",
    });

    const first = expiredRequest.proposeCategoryFromFactory({
      requestFactory: async () => {
        contextEntered();
        await contextBlocked;
        return REQUEST;
      },
      requestClass: "routine",
      idempotencyKey: "operation-context-expired",
    });
    await entered;
    clock = new Date(NOW.getTime() + 60_000);
    releaseContext();
    await Promise.race([
      expiredProviderEntry,
      first,
    ]);

    let overlapObserved = false;
    const replacementProviderCall = vi.fn(async () => {
      overlapObserved = expiredProviderActive;
      return success();
    });
    const replacement = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository,
      provider: { proposeCategoryResult: replacementProviderCall },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => clock,
      createReservationId: () => "reservation-after-context-expiry",
    });
    const replacementResult = await replacement.proposeCategoryResult({
      request: { ...REQUEST, subjectId: "event-after-context-expiry" },
      requestClass: "routine",
      idempotencyKey: "operation-after-context-expiry",
    });
    releaseExpiredProvider();
    const expiredResult = await first;

    expect(expiredResult).toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(replacementResult).toMatchObject({ status: "success" });
    expect(expiredProviderCall).not.toHaveBeenCalled();
    expect(replacementProviderCall).toHaveBeenCalledOnce();
    expect(overlapObserved).toBe(false);
    const retryFactory = vi.fn(async () => REQUEST);
    await expect(
      expiredRequest.proposeCategoryFromFactory({
        requestFactory: retryFactory,
        requestClass: "routine",
        idempotencyKey: "operation-context-expired",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_DUPLICATE_REQUEST",
      mode: "blocked",
    });
    expect(retryFactory).not.toHaveBeenCalled();
    expect(expiredProviderCall).not.toHaveBeenCalled();
    expect(
      (
        await pglite.query(
          `select id, status
           from ai_usage_reservations
           where id in (
             'reservation-context-expired',
             'reservation-after-context-expiry'
           )
           order by id`,
        )
      ).rows,
    ).toEqual([
      { id: "reservation-after-context-expiry", status: "settled" },
      { id: "reservation-context-expired", status: "released" },
    ]);
  });

  it("rejects an old context loader after a replacement reservation owns the lease", async () => {
    let clock = NOW;
    let releaseContext!: () => void;
    const contextBlocked = new Promise<void>((resolve) => {
      releaseContext = resolve;
    });
    let contextEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      contextEntered = resolve;
    });
    const oldProviderCall = vi.fn(async () => success());
    const oldRequest = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository,
      provider: { proposeCategoryResult: oldProviderCall },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => clock,
      createReservationId: () => "reservation-old-loader",
    });
    const oldResultPromise = oldRequest.proposeCategoryFromFactory({
      requestFactory: async () => {
        contextEntered();
        await contextBlocked;
        return REQUEST;
      },
      requestClass: "routine",
      idempotencyKey: "operation-old-loader",
    });
    await entered;

    clock = new Date(NOW.getTime() + 60_000);
    let releaseReplacement!: () => void;
    const replacementBlocked = new Promise<void>((resolve) => {
      releaseReplacement = resolve;
    });
    let replacementEntered!: () => void;
    const replacementEntry = new Promise<void>((resolve) => {
      replacementEntered = resolve;
    });
    const replacementProviderCall = vi.fn(async () => {
      replacementEntered();
      await replacementBlocked;
      return success();
    });
    const replacement = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository,
      provider: { proposeCategoryResult: replacementProviderCall },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => clock,
      createReservationId: () => "reservation-new-loader",
    });
    const replacementResultPromise = replacement.proposeCategoryResult({
      request: { ...REQUEST, subjectId: "event-new-loader" },
      requestClass: "routine",
      idempotencyKey: "operation-new-loader",
    });
    await replacementEntry;

    releaseContext();
    const oldResult = await oldResultPromise;
    expect(oldResult).toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(oldProviderCall).not.toHaveBeenCalled();

    const third = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository,
      provider: { proposeCategoryResult: vi.fn(async () => success()) },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => new Date(clock.getTime() + 1),
      createReservationId: () => "reservation-third-loader",
    });
    await expect(
      third.proposeCategoryResult({
        request: { ...REQUEST, subjectId: "event-third-loader" },
        requestClass: "routine",
        idempotencyKey: "operation-third-loader",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_CONCURRENCY_UNAVAILABLE",
      mode: "normal",
    });

    releaseReplacement();
    await expect(replacementResultPromise).resolves.toMatchObject({
      status: "success",
    });
    expect(replacementProviderCall).toHaveBeenCalledOnce();
  });

  it("fails closed before dispatch when the injected clock moves backward", async () => {
    const clock = vi
      .fn<() => Date>()
      .mockReturnValueOnce(NOW)
      .mockReturnValueOnce(new Date(NOW.getTime() - 1));
    const { budgeted, proposeCategoryResult } = createProvider(success(), clock);

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "operation-backward-clock",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(proposeCategoryResult).not.toHaveBeenCalled();
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 0, reserved_cents: 0 },
    ]);
  });

  it("releases pre-dispatch work when the fresh dispatch clock throws", async () => {
    const clock = vi
      .fn<() => Date>()
      .mockReturnValueOnce(NOW)
      .mockImplementationOnce(() => {
        throw new Error("synthetic clock failure");
      });
    const { budgeted, proposeCategoryResult } = createProvider(success(), clock);

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "operation-throwing-clock",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(proposeCategoryResult).not.toHaveBeenCalled();
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 0, reserved_cents: 0 },
    ]);
  });

  it("allows exactly one in-flight AI request for the owner", async () => {
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let providerEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      providerEntered = resolve;
    });
    const { budgeted, proposeCategoryResult } = createProvider(async () => {
      providerEntered();
      await firstBlocked;
      return success();
    });

    const first = budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "operation-concurrent-1",
    });
    await entered;
    const second = await budgeted.proposeCategoryResult({
      request: { ...REQUEST, subjectId: "event-2" },
      requestClass: "routine",
      idempotencyKey: "operation-concurrent-2",
    });
    releaseFirst();
    await first;

    expect(second).toEqual({
      status: "unavailable",
      code: "AI_CONCURRENCY_UNAVAILABLE",
      mode: "normal",
    });
    expect(proposeCategoryResult).toHaveBeenCalledOnce();
  });

  it("releases a reservation when dispatch marking fails before provider dispatch", async () => {
    const delegate = repository;
    const failingRepository: AiUsageRepository = {
      reserve: (...arguments_) => delegate.reserve(...arguments_),
      markDispatched: async () => {
        throw new Error("synthetic pre-dispatch persistence failure");
      },
      settle: (...arguments_) => delegate.settle(...arguments_),
      release: (...arguments_) => delegate.release(...arguments_),
    };
    const proposeCategoryResult = vi.fn(async () => success());
    const budgeted = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository: failingRepository,
      provider: { proposeCategoryResult },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => NOW,
      createReservationId: () => "reservation-pre-dispatch",
    });

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "operation-pre-dispatch",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(proposeCategoryResult).not.toHaveBeenCalled();
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 0, reserved_cents: 0 },
    ]);
  });

  it("does not invoke the provider for a duplicate dispatch marker", async () => {
    const providerCall = vi.fn(async () => success());
    const release = vi.fn<AiUsageRepository["release"]>(async () => "duplicate");
    const duplicateDispatchRepository: AiUsageRepository = {
      reserve: async (input) => ({
        status: "reserved",
        reservationId: input.reservationId,
        budgetMonth: "2026-07",
        projectedCents: 10,
      }),
      markDispatched: async () => "duplicate",
      settle: async () => "duplicate",
      release,
    };
    const budgeted = new BudgetedAiProvider({
      ownerId: OWNER_ID,
      repository: duplicateDispatchRepository,
      provider: { proposeCategoryResult: providerCall },
      pricing: PRICING,
      reservationTtlMs: 60_000,
      now: () => NOW,
      createReservationId: () => "reservation-duplicate-dispatch",
    });

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "operation-duplicate-dispatch",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_DUPLICATE_REQUEST",
      mode: "normal",
    });
    expect(providerCall).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("conservatively settles the estimate after a dispatched gateway rejection", async () => {
    const { budgeted } = createProvider({
      status: "provider_error",
      code: "AI_PROVIDER_ERROR",
      metadata: {
        requestedModelId: "gpt-5.6-luna",
        modelId: "gpt-5.6-luna",
        policyVersion: "category-v1",
        evidenceIds: ["evidence-1"],
      },
    });

    const result = await budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "gateway-rejected",
    });

    expect(result.status).toBe("provider_error");
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 10, reserved_cents: 0 },
    ]);
  });

  it("settles provider actual cost above the reservation without hiding the overage", async () => {
    const expensiveUsage: OpenAiUsageMetadata = {
      ...USAGE,
      inputTokens: 20_000_000,
      outputTokens: 0,
      totalTokens: 20_000_000,
    };
    const { budgeted } = createProvider(success(expensiveUsage));

    await budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "provider-over-estimate",
    });

    expect(await monthlyUsage()).toEqual([
      { settled_cents: 20_000, reserved_cents: 0 },
    ]);
  });

  it("fails closed and charges the estimate for invalid provider usage metadata", async () => {
    const invalidUsage = {
      ...USAGE,
      inputTokens: Number.NaN,
    } as OpenAiUsageMetadata;
    const { budgeted } = createProvider(success(invalidUsage));

    await expect(
      budgeted.proposeCategoryResult({
        request: REQUEST,
        requestClass: "routine",
        idempotencyKey: "invalid-provider-usage",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      code: "AI_ACCOUNTING_UNAVAILABLE",
      mode: "normal",
    });
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 10, reserved_cents: 0 },
    ]);
  });

  it("expires stale pre-dispatch work and takes over its concurrency lease", async () => {
    await repository.reserve({
      reservationId: "stale-pre-dispatch",
      ownerId: OWNER_ID,
      idempotencyKey: "stale-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: new Date(NOW.getTime() - 120_000),
      expiresAt: new Date(NOW.getTime() - 60_000),
    });
    const { budgeted, proposeCategoryResult } = createProvider();

    const result = await budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "takeover-operation",
    });

    expect(result.status).toBe("success");
    expect(proposeCategoryResult).toHaveBeenCalledOnce();
    expect(
      (
        await pglite.query(
          `select id, status from ai_usage_reservations order by created_at`,
        )
      ).rows,
    ).toEqual([
      { id: "stale-pre-dispatch", status: "released" },
      { id: expect.any(String), status: "settled" },
    ]);
  });

  it("charges a stale dispatched reservation before taking over", async () => {
    const stale = await repository.reserve({
      reservationId: "stale-dispatched",
      ownerId: OWNER_ID,
      idempotencyKey: "stale-dispatched-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: new Date(NOW.getTime() - 120_000),
      expiresAt: new Date(NOW.getTime() - 60_000),
    });
    expect(stale.status).toBe("reserved");
    await repository.markDispatched(
      "stale-dispatched",
      OWNER_ID,
      new Date(NOW.getTime() - 119_000),
      new Date(NOW.getTime() - 60_000),
    );
    const { budgeted } = createProvider();

    await budgeted.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "after-dispatched-crash",
    });

    expect(await monthlyUsage()).toEqual([
      { settled_cents: 11, reserved_cents: 0 },
    ]);
    expect(
      (
        await pglite.query(
          `select status, actual_cents
           from ai_usage_reservations
           where id = 'stale-dispatched'`,
        )
      ).rows,
    ).toEqual([{ status: "settled_estimate", actual_cents: 10 }]);
  });

  it("reconciles a late actual cost after conservative stale settlement", async () => {
    await repository.reserve({
      reservationId: "late-actual",
      ownerId: OWNER_ID,
      idempotencyKey: "late-actual-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: new Date(NOW.getTime() - 120_000),
      expiresAt: new Date(NOW.getTime() - 60_000),
    });
    await repository.markDispatched(
      "late-actual",
      OWNER_ID,
      new Date(NOW.getTime() - 119_000),
      new Date(NOW.getTime() - 60_000),
    );
    const takeover = await repository.reserve({
      reservationId: "takeover-for-late-actual",
      ownerId: OWNER_ID,
      idempotencyKey: "takeover-for-late-actual-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    expect(takeover.status).toBe("reserved");

    await expect(
      repository.settle({
        reservationId: "late-actual",
        ownerId: OWNER_ID,
        actualCents: 25,
        metadata: {
          providerRequestId: "response-late",
          modelId: "gpt-5.6-luna",
          inputTokens: 2,
          outputTokens: 1,
          totalTokens: 3,
        },
        now: new Date(NOW.getTime() + 1_000),
      }),
    ).resolves.toBe("settled");

    expect(await monthlyUsage()).toEqual([
      { settled_cents: 25, reserved_cents: 10 },
    ]);
  });

  it("makes duplicate settle and release operations safe", async () => {
    const reservation = await repository.reserve({
      reservationId: "reservation-idempotent",
      ownerId: OWNER_ID,
      idempotencyKey: "operation-idempotent",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    expect(reservation.status).toBe("reserved");
    await repository.markDispatched(
      "reservation-idempotent",
      OWNER_ID,
      NOW,
      new Date(NOW.getTime() + 60_000),
    );

    const first = await repository.settle({
      reservationId: "reservation-idempotent",
      ownerId: OWNER_ID,
      actualCents: 3,
      metadata: {
        providerRequestId: "response-idempotent",
        modelId: "gpt-5.6-luna",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
      now: NOW,
    });
    const duplicate = await repository.settle({
      reservationId: "reservation-idempotent",
      ownerId: OWNER_ID,
      actualCents: 3,
      metadata: {
        providerRequestId: "response-idempotent",
        modelId: "gpt-5.6-luna",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
      now: NOW,
    });
    const released = await repository.release(
      "reservation-idempotent",
      OWNER_ID,
      NOW,
    );

    expect(first).toBe("settled");
    expect(duplicate).toBe("duplicate");
    expect(released).toBe("duplicate");
    expect(await monthlyUsage()).toEqual([
      { settled_cents: 3, reserved_cents: 0 },
    ]);
    await expect(
      repository.settle({
        reservationId: "reservation-idempotent",
        ownerId: OWNER_ID,
        actualCents: 4,
        metadata: {
          providerRequestId: "response-conflicting",
          modelId: "gpt-5.6-luna",
          inputTokens: 2,
          outputTokens: 2,
          totalTokens: 4,
        },
        now: NOW,
      }),
    ).rejects.toThrow("Conflicting AI settlement.");
  });

  it("retains an append-only, content-free transition ledger", async () => {
    const { budgeted } = createProvider();
    await budgeted.proposeCategoryResult({
      request: {
        ...REQUEST,
        context: {
          title: "private prompt sentinel",
          response: "private response sentinel",
        },
      },
      requestClass: "routine",
      idempotencyKey: "ledger-content-boundary",
    });

    const rows = (
      await pglite.query(
        `select event_type, estimated_cents, actual_cents
         from ai_usage_ledger
         order by case event_type
           when 'reserved' then 1
           when 'dispatched' then 2
           when 'settled' then 3
           else 4
         end`,
      )
    ).rows;
    expect(rows).toEqual([
      { event_type: "reserved", estimated_cents: 10, actual_cents: null },
      { event_type: "dispatched", estimated_cents: 10, actual_cents: null },
      { event_type: "settled", estimated_cents: 10, actual_cents: 1 },
    ]);
    const columns = (
      await pglite.query(
        `select column_name
         from information_schema.columns
         where table_name = 'ai_usage_ledger'`,
      )
    ).rows.map((row) => (row as { column_name: string }).column_name);
    expect(columns).not.toContain("prompt");
    expect(columns).not.toContain("response");
    expect(JSON.stringify(rows)).not.toContain("private prompt sentinel");
    expect(JSON.stringify(rows)).not.toContain("private response sentinel");
  });

  it("starts a fresh ledger month at Chicago midnight across DST-independent UTC", async () => {
    const julyProvider = createProvider(
      success(),
      () => new Date("2026-08-01T04:59:59.000Z"),
    ).budgeted;
    await julyProvider.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "july-operation",
    });
    const augustProvider = createProvider(
      success(),
      () => new Date("2026-08-01T05:00:00.000Z"),
    ).budgeted;
    await augustProvider.proposeCategoryResult({
      request: REQUEST,
      requestClass: "routine",
      idempotencyKey: "august-operation",
    });

    expect(await monthlyUsage("2026-07")).toEqual([
      { settled_cents: 1, reserved_cents: 0 },
    ]);
    expect(await monthlyUsage("2026-08")).toEqual([
      { settled_cents: 1, reserved_cents: 0 },
    ]);
  });

  it("rejects invalid or missing injected price and worst-case inputs", () => {
    expect(
      () =>
        new BudgetedAiProvider({
          ownerId: OWNER_ID,
          repository,
          provider: { proposeCategoryResult: vi.fn() },
          pricing: {
            ...PRICING,
            inputCentsPerMillionTokens: Number.NaN,
          },
          reservationTtlMs: 60_000,
          now: () => NOW,
          createReservationId: () => "reservation-invalid-pricing",
        }),
    ).toThrow("AI pricing configuration is invalid.");
  });

  it("requires the dispatch lease to outlive the longest accepted provider timeout", () => {
    expect(
      () =>
        new BudgetedAiProvider({
          ownerId: OWNER_ID,
          repository,
          provider: { proposeCategoryResult: vi.fn() },
          pricing: PRICING,
          reservationTtlMs: MAX_OPENAI_PROVIDER_TIMEOUT_MS * 2 - 1,
          now: () => NOW,
          createReservationId: () => "reservation-short-dispatch-lease",
        }),
    ).toThrow("AI pricing configuration is invalid.");
  });
});
