import { describe, expect, it } from "vitest";
import {
  AI_PRICING_POLICY_VALUES,
  type AiPricingBindingName,
} from "../../../src/server/ai-pricing-binding-contract";
import { AiBudgetEnvSchema } from "../../../src/server/env";

const EXACT_RUNTIME_POLICY = Object.freeze({
  AI_MONTHLY_HARD_LIMIT_CENTS: "950",
  ...AI_PRICING_POLICY_VALUES,
});

describe("AI pricing runtime policy", () => {
  it("parses the exact canonical Worker strings to numeric domain values", () => {
    expect(AiBudgetEnvSchema.parse(EXACT_RUNTIME_POLICY)).toEqual({
      AI_MONTHLY_HARD_LIMIT_CENTS: 950,
      AI_COMPLEX_WORST_CASE_CENTS: 50,
      AI_INPUT_CENTS_PER_MILLION_TOKENS: 100,
      AI_OPTIONAL_WORST_CASE_CENTS: 20,
      AI_OUTPUT_CENTS_PER_MILLION_TOKENS: 600,
      AI_ROUTINE_WORST_CASE_CENTS: 10,
    });
  });

  it.each(Object.keys(AI_PRICING_POLICY_VALUES) as AiPricingBindingName[])(
    "rejects a stale or arbitrary %s",
    (name) => {
      expect(() =>
        AiBudgetEnvSchema.parse({
          ...EXACT_RUNTIME_POLICY,
          [name]: String(Number(AI_PRICING_POLICY_VALUES[name]) + 1),
        }),
      ).toThrow();
    },
  );

  it.each([" 10", "010", "1.0", 10, null, true])(
    "rejects malformed or wrong-typed pricing value %j",
    (invalid) => {
      expect(() =>
        AiBudgetEnvSchema.parse({
          ...EXACT_RUNTIME_POLICY,
          AI_ROUTINE_WORST_CASE_CENTS: invalid,
        }),
      ).toThrow();
    },
  );

  it("rejects a missing or extra pricing field", () => {
    const {
      AI_ROUTINE_WORST_CASE_CENTS: _missing,
      ...missing
    } = EXACT_RUNTIME_POLICY;
    expect(() => AiBudgetEnvSchema.parse(missing)).toThrow();
    expect(() =>
      AiBudgetEnvSchema.parse({
        ...EXACT_RUNTIME_POLICY,
        AI_UNAPPROVED_CENTS: "1",
      }),
    ).toThrow();
  });
});
