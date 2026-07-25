/** Wraps the accepted OpenAI adapter with durable budget and concurrency admission. */
import type { CategoryProposal } from "../../domain/categorization/proposal";
import {
  evaluateAiBudget,
  type AiBudgetDecision,
  type AiRequestClass,
} from "../../domain/budget/ai-budget";
import type {
  AiUsageRepository,
  AiUsageSettlementMetadata,
} from "../../data/repositories/ai-usage-repository";
import type { AiProvider, CategoryProposalRequest } from "./ai-provider";
import type {
  OpenAiProviderResult,
  OpenAiUsageMetadata,
} from "./openai-provider";

/** Supplies injected rates and worst-case reservations without assuming provider prices. */
export interface AiPricingConfiguration {
  readonly inputCentsPerMillionTokens: number;
  readonly outputCentsPerMillionTokens: number;
  readonly worstCaseCents: Readonly<Record<AiRequestClass, number>>;
}

/** Describes a single auditable budget admission request without provider content. */
export interface BudgetedCategoryProposalRequest {
  readonly request: CategoryProposalRequest;
  readonly requestClass: AiRequestClass;
  readonly idempotencyKey: string;
}

/** Defers provider context construction until durable budget admission has succeeded. */
export interface BudgetedCategoryProposalFactoryRequest {
  /** Builds the provider request only after admission succeeds. */
  readonly requestFactory: () => CategoryProposalRequest;
  readonly requestClass: AiRequestClass;
  readonly idempotencyKey: string;
}

/** Enumerates typed admission failures that never invoke or expose provider content. */
export type BudgetedAiUnavailableResult = {
  readonly status: "unavailable";
  readonly code:
    | "AI_BUDGET_EXHAUSTED"
    | "AI_CONCURRENCY_UNAVAILABLE"
    | "AI_ACCOUNTING_UNAVAILABLE"
    | "AI_DUPLICATE_REQUEST";
  readonly mode: AiBudgetDecision["mode"];
};

/** Returns either the accepted adapter result or a pre-provider budget result. */
export type BudgetedOpenAiProviderResult =
  | OpenAiProviderResult
  | BudgetedAiUnavailableResult;

/** Defines only the accepted safe-result method needed from the network adapter. */
export interface MeteredOpenAiProvider {
  proposeCategoryResult(
    request: CategoryProposalRequest,
  ): Promise<OpenAiProviderResult>;
}

/** Supplies all deterministic clock, identity, repository, and price dependencies. */
export interface BudgetedAiProviderOptions {
  readonly ownerId: string;
  readonly repository: AiUsageRepository;
  readonly provider: MeteredOpenAiProvider;
  readonly pricing: AiPricingConfiguration;
  readonly reservationTtlMs: number;
  readonly now: () => Date;
  readonly createReservationId: () => string;
}

/** Carries a privacy-safe typed failure for the provider-neutral AiProvider port. */
export class BudgetedAiProviderError extends Error {
  constructor(readonly code: BudgetedAiUnavailableResult["code"] | string) {
    super("AI category proposal is unavailable.");
    this.name = "BudgetedAiProviderError";
  }
}

/** Enforces monthly reservations and exactly one owner call before dispatch. */
export class BudgetedAiProvider implements AiProvider {
  readonly #ownerId: string;
  readonly #repository: AiUsageRepository;
  readonly #provider: MeteredOpenAiProvider;
  readonly #pricing: AiPricingConfiguration;
  readonly #reservationTtlMs: number;
  readonly #now: () => Date;
  readonly #createReservationId: () => string;

  constructor(options: BudgetedAiProviderOptions) {
    if (
      !isOpaqueIdentifier(options.ownerId) ||
      typeof options.repository?.reserve !== "function" ||
      typeof options.repository?.markDispatched !== "function" ||
      typeof options.repository?.settle !== "function" ||
      typeof options.repository?.release !== "function" ||
      typeof options.provider?.proposeCategoryResult !== "function" ||
      typeof options.now !== "function" ||
      typeof options.createReservationId !== "function" ||
      !Number.isSafeInteger(options.reservationTtlMs) ||
      options.reservationTtlMs < 1_000 ||
      options.reservationTtlMs > 15 * 60_000 ||
      !isValidPricing(options.pricing)
    ) {
      throw new Error("AI pricing configuration is invalid.");
    }
    this.#ownerId = options.ownerId;
    this.#repository = options.repository;
    this.#provider = options.provider;
    this.#pricing = {
      inputCentsPerMillionTokens:
        options.pricing.inputCentsPerMillionTokens,
      outputCentsPerMillionTokens:
        options.pricing.outputCentsPerMillionTokens,
      worstCaseCents: { ...options.pricing.worstCaseCents },
    };
    this.#reservationTtlMs = options.reservationTtlMs;
    this.#now = options.now;
    this.#createReservationId = options.createReservationId;
  }

  /** Implements AiProvider with routine admission and a generated opaque operation identity. */
  async proposeCategory(request: CategoryProposalRequest): Promise<CategoryProposal> {
    const operationId = this.#createReservationId();
    const result = await this.proposeCategoryResult({
      request,
      requestClass: "routine",
      idempotencyKey: operationId,
    });
    if (result.status === "success") {
      return result.proposal;
    }
    throw new BudgetedAiProviderError(
      result.status === "unavailable" ? result.code : result.code,
    );
  }

  /** Reserves, marks dispatch, invokes once, and settles only safe cost metadata. */
  async proposeCategoryResult(
    input: BudgetedCategoryProposalRequest,
  ): Promise<BudgetedOpenAiProviderResult> {
    return this.proposeCategoryFromFactory({
      /** Returns the already-validated eager request through the lazy admission contract. */
      requestFactory: () => input.request,
      requestClass: input.requestClass,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** Reserves first, then builds bounded context, marks dispatch, invokes once, and settles. */
  async proposeCategoryFromFactory(
    input: BudgetedCategoryProposalFactoryRequest,
  ): Promise<BudgetedOpenAiProviderResult> {
    const now = this.#now();
    const reservationId = this.#createReservationId();
    const estimatedCents = this.#pricing.worstCaseCents[input.requestClass];
    if (
      !isOpaqueIdentifier(input.idempotencyKey) ||
      typeof input.requestFactory !== "function" ||
      !isOpaqueIdentifier(reservationId) ||
      !isValidDate(now) ||
      !Number.isSafeInteger(estimatedCents) ||
      estimatedCents <= 0
    ) {
      return unavailable("AI_ACCOUNTING_UNAVAILABLE", "blocked");
    }

    let reservation;
    try {
      reservation = await this.#repository.reserve({
        reservationId,
        ownerId: this.#ownerId,
        idempotencyKey: input.idempotencyKey,
        requestClass: input.requestClass,
        estimatedCents,
        now,
        expiresAt: new Date(
          Date.prototype.getTime.call(now) + this.#reservationTtlMs,
        ),
      });
    } catch {
      return unavailable("AI_ACCOUNTING_UNAVAILABLE", "blocked");
    }
    if (reservation.status === "duplicate") {
      return unavailable("AI_DUPLICATE_REQUEST", "blocked");
    }
    if (reservation.status === "denied") {
      const decision = evaluateAiBudget(
        reservation.projectedCents,
        input.requestClass,
      );
      return reservation.reason === "concurrency"
        ? unavailable("AI_CONCURRENCY_UNAVAILABLE", decision.mode)
        : unavailable("AI_BUDGET_EXHAUSTED", "blocked");
    }
    const decision = evaluateAiBudget(
      reservation.projectedCents,
      input.requestClass,
    );
    if (!decision.allowed) {
      // This path is fail-closed defense in depth; the repository applies the same boundaries.
      await this.releaseSafely(reservationId, now);
      return unavailable("AI_BUDGET_EXHAUSTED", "blocked");
    }

    let request: CategoryProposalRequest;
    try {
      request = input.requestFactory();
    } catch (error) {
      await this.releaseSafely(reservationId, now);
      throw error;
    }

    try {
      await this.#repository.markDispatched(
        reservationId,
        this.#ownerId,
        now,
      );
    } catch {
      await this.releaseSafely(reservationId, now);
      return unavailable("AI_ACCOUNTING_UNAVAILABLE", decision.mode);
    }

    let providerResult: OpenAiProviderResult;
    try {
      providerResult = await this.#provider.proposeCategoryResult(request);
    } catch {
      const settled = await this.settleSafely(
        reservationId,
        estimatedCents,
        {},
        this.#now(),
      );
      return settled
        ? {
            status: "provider_error",
            code: "AI_PROVIDER_ERROR",
            metadata: {
              requestedModelId: "gpt-5.6-luna",
              modelId: "gpt-5.6-luna",
              policyVersion: "",
              evidenceIds: [],
            },
          }
        : unavailable("AI_ACCOUNTING_UNAVAILABLE", decision.mode);
    }

    const usage = providerResult.metadata.usage;
    let actualCents: number;
    try {
      actualCents =
        usage === undefined
          ? estimatedCents
          : calculateActualCents(usage, this.#pricing);
    } catch {
      await this.settleSafely(
        reservationId,
        estimatedCents,
        {},
        this.#now(),
      );
      return unavailable("AI_ACCOUNTING_UNAVAILABLE", decision.mode);
    }
    const settled = await this.settleSafely(
      reservationId,
      actualCents,
      settlementMetadata(providerResult),
      this.#now(),
    );
    return settled
      ? providerResult
      : unavailable("AI_ACCOUNTING_UNAVAILABLE", decision.mode);
  }

  /** Releases only a reservation whose dispatch marker could not be written. */
  private async releaseSafely(
    reservationId: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.#repository.release(reservationId, this.#ownerId, now);
    } catch {
      // The durable reservation remains fail-closed when accounting is unavailable.
    }
  }

  /** Settles actual or conservative cost without allowing persistence errors to leak. */
  private async settleSafely(
    reservationId: string,
    actualCents: number,
    metadata: AiUsageSettlementMetadata,
    now: Date,
  ): Promise<boolean> {
    try {
      await this.#repository.settle({
        reservationId,
        ownerId: this.#ownerId,
        actualCents,
        metadata,
        now,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Calculates rounded-up cents with integer arithmetic and no embedded price assumptions. */
export function calculateActualCents(
  usage: OpenAiUsageMetadata,
  pricing: Pick<
    AiPricingConfiguration,
    "inputCentsPerMillionTokens" | "outputCentsPerMillionTokens"
  >,
): number {
  if (
    !isValidRate(pricing.inputCentsPerMillionTokens) ||
    !isValidRate(pricing.outputCentsPerMillionTokens) ||
    !isValidTokenCount(usage.inputTokens) ||
    !isValidTokenCount(usage.outputTokens)
  ) {
    throw new Error("AI pricing configuration is invalid.");
  }
  const numerator =
    BigInt(usage.inputTokens) *
      BigInt(pricing.inputCentsPerMillionTokens) +
    BigInt(usage.outputTokens) *
      BigInt(pricing.outputCentsPerMillionTokens);
  const cents = (numerator + 999_999n) / 1_000_000n;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("AI provider cost is invalid.");
  }
  return Number(cents);
}

/** Copies only safe provider accounting fields into the durable ledger. */
function settlementMetadata(
  result: OpenAiProviderResult,
): AiUsageSettlementMetadata {
  const usage = result.metadata.usage;
  return {
    ...(result.metadata.requestId === undefined
      ? {}
      : { providerRequestId: result.metadata.requestId }),
    modelId: result.metadata.modelId,
    ...(usage === undefined
      ? {}
      : {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        }),
  };
}

/** Creates one typed unavailable result. */
function unavailable(
  code: BudgetedAiUnavailableResult["code"],
  mode: AiBudgetDecision["mode"],
): BudgetedAiUnavailableResult {
  return { status: "unavailable", code, mode };
}

/** Validates the entire injected pricing contract without reading provider defaults. */
function isValidPricing(
  pricing: AiPricingConfiguration,
): boolean {
  return (
    pricing !== null &&
    typeof pricing === "object" &&
    isValidRate(pricing.inputCentsPerMillionTokens) &&
    isValidRate(pricing.outputCentsPerMillionTokens) &&
    pricing.worstCaseCents !== null &&
    typeof pricing.worstCaseCents === "object" &&
    Object.keys(pricing.worstCaseCents).length === 3 &&
    (["routine", "optional", "complex"] as const).every(
      (requestClass) =>
        Number.isSafeInteger(pricing.worstCaseCents[requestClass]) &&
        pricing.worstCaseCents[requestClass] > 0 &&
        pricing.worstCaseCents[requestClass] < 950,
    )
  );
}

/** Validates an injected per-million-token cent rate. */
function isValidRate(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000;
}

/** Validates bounded provider token counts before BigInt conversion. */
function isValidTokenCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;
}

/** Validates a bounded opaque owner, operation, or reservation identifier. */
function isOpaqueIdentifier(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value)
  );
}

/** Validates a genuine timestamp through trusted intrinsics. */
function isValidDate(value: Date): boolean {
  return (
    value instanceof Date &&
    !Number.isNaN(Date.prototype.getTime.call(value))
  );
}
