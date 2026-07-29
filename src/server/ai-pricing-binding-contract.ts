/** Exact server-only contract for the AI pricing and reservation bindings. */

export type AiPricingBindingName =
  | "AI_COMPLEX_WORST_CASE_CENTS"
  | "AI_INPUT_CENTS_PER_MILLION_TOKENS"
  | "AI_OPTIONAL_WORST_CASE_CENTS"
  | "AI_OUTPUT_CENTS_PER_MILLION_TOKENS"
  | "AI_ROUTINE_WORST_CASE_CENTS";

/** One reproducibly provisioned server-only AI cost binding. */
export interface AiPricingBindingContractEntry {
  readonly name: AiPricingBindingName;
  readonly type: "plain_text";
  readonly basis:
    | "gated_terra_bounded_request"
    | "luna_standard_input_rate"
    | "luna_bounded_optional_request"
    | "luna_standard_output_rate"
    | "luna_bounded_routine_request";
  readonly value: string;
}

/**
 * Approved private-pilot policy: canonical whole cents per million tokens for
 * model rates and canonical whole-cent reservations for the three request
 * tiers. Any price or request-bound change updates this one record and every
 * exact attestation in the same reviewed commit.
 */
export const AI_PRICING_POLICY_VALUES: Readonly<
  Record<AiPricingBindingName, string>
> = Object.freeze({
  AI_COMPLEX_WORST_CASE_CENTS: "50",
  AI_INPUT_CENTS_PER_MILLION_TOKENS: "100",
  AI_OPTIONAL_WORST_CASE_CENTS: "20",
  AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "600",
  AI_ROUTINE_WORST_CASE_CENTS: "10",
});

/** Exact binding names, provider types, policy bases, and provisioned values. */
export const AI_PRICING_BINDING_CONTRACT: readonly AiPricingBindingContractEntry[] =
  Object.freeze([
    Object.freeze({
      name: "AI_COMPLEX_WORST_CASE_CENTS",
      type: "plain_text",
      basis: "gated_terra_bounded_request",
      value: AI_PRICING_POLICY_VALUES.AI_COMPLEX_WORST_CASE_CENTS,
    }),
    Object.freeze({
      name: "AI_INPUT_CENTS_PER_MILLION_TOKENS",
      type: "plain_text",
      basis: "luna_standard_input_rate",
      value: AI_PRICING_POLICY_VALUES.AI_INPUT_CENTS_PER_MILLION_TOKENS,
    }),
    Object.freeze({
      name: "AI_OPTIONAL_WORST_CASE_CENTS",
      type: "plain_text",
      basis: "luna_bounded_optional_request",
      value: AI_PRICING_POLICY_VALUES.AI_OPTIONAL_WORST_CASE_CENTS,
    }),
    Object.freeze({
      name: "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
      type: "plain_text",
      basis: "luna_standard_output_rate",
      value: AI_PRICING_POLICY_VALUES.AI_OUTPUT_CENTS_PER_MILLION_TOKENS,
    }),
    Object.freeze({
      name: "AI_ROUTINE_WORST_CASE_CENTS",
      type: "plain_text",
      basis: "luna_bounded_routine_request",
      value: AI_PRICING_POLICY_VALUES.AI_ROUTINE_WORST_CASE_CENTS,
    }),
  ]);

/** Rejects missing, stale, malformed, extra, or otherwise arbitrary values. */
export function assertAiPricingPolicyValues(input: unknown): void {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new Error("AI pricing policy attestation is invalid.");
  }
  const record = input as Record<string, unknown>;
  const expectedNames = Object.keys(AI_PRICING_POLICY_VALUES).sort();
  const actualNames = Object.keys(record).sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index]) ||
    expectedNames.some(
      (name) =>
        record[name] !==
        AI_PRICING_POLICY_VALUES[name as AiPricingBindingName],
    )
  ) {
    throw new Error("AI pricing policy attestation is invalid.");
  }
}

/** Operator role accountable for checking the external values against primary sources. */
export const AI_PRICING_CONTRACT_OWNER = "AI integration owner" as const;

/** Events that require a fresh value attestation before AI traffic or release. */
export const AI_PRICING_REFRESH_TRIGGERS = Object.freeze([
  "before_preview_ai_acceptance",
  "before_production_release",
  "provider_price_change",
  "model_or_request_bound_change",
] as const);
