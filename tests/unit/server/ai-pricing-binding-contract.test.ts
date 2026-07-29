import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_PRICING_BINDING_CONTRACT,
  AI_PRICING_CONTRACT_OWNER,
  AI_PRICING_REFRESH_TRIGGERS,
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
  it("defines all five names once as external secret-text bindings without values", () => {
    expect(AI_PRICING_BINDING_CONTRACT).toEqual([
      {
        name: "AI_COMPLEX_WORST_CASE_CENTS",
        type: "secret_text",
        basis: "gated_terra_bounded_request",
      },
      {
        name: "AI_INPUT_CENTS_PER_MILLION_TOKENS",
        type: "secret_text",
        basis: "luna_standard_input_rate",
      },
      {
        name: "AI_OPTIONAL_WORST_CASE_CENTS",
        type: "secret_text",
        basis: "luna_bounded_optional_request",
      },
      {
        name: "AI_OUTPUT_CENTS_PER_MILLION_TOKENS",
        type: "secret_text",
        basis: "luna_standard_output_rate",
      },
      {
        name: "AI_ROUTINE_WORST_CASE_CENTS",
        type: "secret_text",
        basis: "luna_bounded_routine_request",
      },
    ]);
    expect(new Set(AI_PRICING_BINDING_CONTRACT.map(({ name }) => name)).size).toBe(
      EXPECTED_BINDINGS.length,
    );
    expect(
      AI_PRICING_BINDING_CONTRACT.every(
        (entry) =>
          Object.keys(entry).sort().join(",") === "basis,name,type" &&
          !Object.hasOwn(entry, "value"),
      ),
    ).toBe(true);
    expect(Object.isFrozen(AI_PRICING_BINDING_CONTRACT)).toBe(true);
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

  it("documents the owner, current primary-source basis, refresh cadence, and value-free attestation", async () => {
    const costReview = await readFile(
      resolve(process.cwd(), "docs", "operations", "cost-review.md"),
      "utf8",
    );

    expect(costReview).toContain("AI integration owner");
    expect(costReview).toContain("before every preview AI acceptance");
    expect(costReview).toContain("before every production release");
    expect(costReview).toContain("official OpenAI API model and pricing pages");
    expect(costReview).toContain(
      "binding names and Cloudflare binding types only",
    );
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
