/** Value-free server-only contract for the AI pricing and reservation bindings. */

/** One externally provisioned server-only AI cost binding. */
export interface AiPricingBindingContractEntry {
  readonly name:
    | "AI_COMPLEX_WORST_CASE_CENTS"
    | "AI_INPUT_CENTS_PER_MILLION_TOKENS"
    | "AI_OPTIONAL_WORST_CASE_CENTS"
    | "AI_OUTPUT_CENTS_PER_MILLION_TOKENS"
    | "AI_ROUTINE_WORST_CASE_CENTS";
  readonly type: "secret_text";
  readonly basis:
    | "gated_terra_bounded_request"
    | "luna_standard_input_rate"
    | "luna_bounded_optional_request"
    | "luna_standard_output_rate"
    | "luna_bounded_routine_request";
}

/** Exact binding names and types; values remain outside source control. */
export const AI_PRICING_BINDING_CONTRACT: readonly AiPricingBindingContractEntry[] =
  Object.freeze([
    Object.freeze({
      name: "AI_COMPLEX_WORST_CASE_CENTS",
      type: "secret_text",
      basis: "gated_terra_bounded_request",
    }),
    Object.freeze({
      name: "AI_INPUT_CENTS_PER_MILLION_TOKENS",
      type: "secret_text",
      basis: "luna_standard_input_rate",
    }),
    Object.freeze({
      name: "AI_OPTIONAL_WORST_CASE_CENTS",
      type: "secret_text",
      basis: "luna_bounded_optional_request",
    }),
    Object.freeze({
      name: "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
      type: "secret_text",
      basis: "luna_standard_output_rate",
    }),
    Object.freeze({
      name: "AI_ROUTINE_WORST_CASE_CENTS",
      type: "secret_text",
      basis: "luna_bounded_routine_request",
    }),
  ]);

/** Operator role accountable for checking the external values against primary sources. */
export const AI_PRICING_CONTRACT_OWNER = "AI integration owner" as const;

/** Events that require a fresh value attestation before AI traffic or release. */
export const AI_PRICING_REFRESH_TRIGGERS = Object.freeze([
  "before_preview_ai_acceptance",
  "before_production_release",
  "provider_price_change",
  "model_or_request_bound_change",
] as const);
