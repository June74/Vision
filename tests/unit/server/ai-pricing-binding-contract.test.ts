import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_PRICING_BINDING_CONTRACT,
  AI_PRICING_CONTRACT_OWNER,
  AI_PRICING_POLICY_VALUES,
  AI_PRICING_REFRESH_TRIGGERS,
  assertAiPricingPolicyValues,
} from "../../../src/server/ai-pricing-binding-contract";
import {
  CLIENT_SAFE_RUNTIME_BINDING_NAMES,
  RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES,
} from "../../../src/server/client-binding-boundary";

const EXPECTED_BINDINGS = [
  "AI_COMPLEX_WORST_CASE_CENTS",
  "AI_INPUT_CENTS_PER_MILLION_TOKENS",
  "AI_OPTIONAL_WORST_CASE_CENTS",
  "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
  "AI_ROUTINE_WORST_CASE_CENTS",
] as const;

describe("server-only AI pricing binding contract", () => {
  it("defines all five names once as reproducible exact plain-text bindings", () => {
    expect(AI_PRICING_BINDING_CONTRACT).toEqual([
      {
        name: "AI_COMPLEX_WORST_CASE_CENTS",
        type: "plain_text",
        basis: "gated_terra_bounded_request",
        value: "50",
      },
      {
        name: "AI_INPUT_CENTS_PER_MILLION_TOKENS",
        type: "plain_text",
        basis: "luna_standard_input_rate",
        value: "100",
      },
      {
        name: "AI_OPTIONAL_WORST_CASE_CENTS",
        type: "plain_text",
        basis: "luna_bounded_optional_request",
        value: "20",
      },
      {
        name: "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
        type: "plain_text",
        basis: "luna_standard_output_rate",
        value: "600",
      },
      {
        name: "AI_ROUTINE_WORST_CASE_CENTS",
        type: "plain_text",
        basis: "luna_bounded_routine_request",
        value: "10",
      },
    ]);
    expect(new Set(AI_PRICING_BINDING_CONTRACT.map(({ name }) => name)).size).toBe(
      EXPECTED_BINDINGS.length,
    );
    expect(
      AI_PRICING_BINDING_CONTRACT.every(
        (entry) =>
          Object.keys(entry).sort().join(",") === "basis,name,type,value",
      ),
    ).toBe(true);
    expect(AI_PRICING_POLICY_VALUES).toEqual({
      AI_COMPLEX_WORST_CASE_CENTS: "50",
      AI_INPUT_CENTS_PER_MILLION_TOKENS: "100",
      AI_OPTIONAL_WORST_CASE_CENTS: "20",
      AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "600",
      AI_ROUTINE_WORST_CASE_CENTS: "10",
    });
    expect(Object.isFrozen(AI_PRICING_BINDING_CONTRACT)).toBe(true);
    expect(Object.isFrozen(AI_PRICING_POLICY_VALUES)).toBe(true);
  });

  it.each([
    [
      "missing",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_ROUTINE_WORST_CASE_CENTS: undefined,
      },
    ],
    [
      "stale",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_INPUT_CENTS_PER_MILLION_TOKENS: "101",
      },
    ],
    [
      "wrong type",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_OPTIONAL_WORST_CASE_CENTS: 20,
      },
    ],
    [
      "malformed",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "0600",
      },
    ],
    [
      "arbitrary",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_COMPLEX_WORST_CASE_CENTS: "99999",
      },
    ],
    [
      "extra",
      {
        ...AI_PRICING_POLICY_VALUES,
        AI_EXTRA_CENTS: "1",
      },
    ],
  ])("rejects %s pricing policy values", (_label, candidate) => {
    expect(() => assertAiPricingPolicyValues(candidate)).toThrow(
      "AI pricing policy attestation is invalid.",
    );
  });

  it("accepts only the exact frozen pricing policy without returning values", () => {
    expect(assertAiPricingPolicyValues(AI_PRICING_POLICY_VALUES)).toBeUndefined();
  });

  it("assigns a fixed owner and explicit refresh triggers", () => {
    expect(AI_PRICING_CONTRACT_OWNER).toBe("AI integration owner");
    expect(AI_PRICING_REFRESH_TRIGGERS).toEqual([
      "before_preview_ai_acceptance",
      "before_production_release",
      "provider_price_change",
      "model_or_request_bound_change",
    ]);
    expect(Object.isFrozen(AI_PRICING_REFRESH_TRIGGERS)).toBe(true);
  });

  it("documents the owner, current primary-source basis, refresh cadence, and exact silent attestation", async () => {
    const costReview = await readFile(
      resolve(process.cwd(), "docs", "operations", "cost-review.md"),
      "utf8",
    );

    expect(costReview).toContain("AI integration owner");
    expect(costReview).toContain("before every preview AI acceptance");
    expect(costReview).toContain("before every production release");
    expect(costReview).toContain("official OpenAI API model and pricing pages");
    expect(costReview).toContain("exact source-controlled policy");
    expect(costReview).toContain("does not print the values");
    for (const name of EXPECTED_BINDINGS) {
      expect(costReview).toContain(name);
    }
  });

  it("classifies every pricing name as client-forbidden and none as client-safe", () => {
    expect(
      EXPECTED_BINDINGS.every((name) =>
        RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES.includes(name),
      ),
    ).toBe(true);
    expect(
      EXPECTED_BINDINGS.every(
        (name) =>
          !(CLIENT_SAFE_RUNTIME_BINDING_NAMES as readonly string[]).includes(
            name,
          ),
      ),
    ).toBe(true);
  });
});
