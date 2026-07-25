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
import type {
  OpenAiProviderResult,
  OpenAiUsageMetadata,
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
});
