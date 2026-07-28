import { describe, expect, it } from "vitest";
import {
  classifyAiSpendTier,
  evaluateAiBudget,
  getChicagoBudgetMonth,
} from "../../../src/domain/budget/ai-budget";

describe("AI budget policy", () => {
  it.each([
    [799, "normal"],
    [800, "warning"],
    [899, "warning"],
    [900, "optional_stopped"],
    [949, "optional_stopped"],
    [950, "stopped"],
  ] as const)("classifies the exact evidence tier at %i cents", (cents, tier) => {
    expect(classifyAiSpendTier(cents)).toBe(tier);
  });

  it.each([-1, Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid evidence tier cents %s",
    (cents) => {
      expect(() => classifyAiSpendTier(cents)).toThrow("Invalid AI spend tier.");
    },
  );
  it.each([
    [0, "routine", true, "normal", false, true],
    [799, "routine", true, "normal", false, true],
    [800, "routine", true, "luna_only", true, false],
    [899, "routine", true, "luna_only", true, false],
    [900, "routine", true, "luna_only", true, false],
    [949, "routine", true, "luna_only", true, false],
    [950, "routine", false, "blocked", true, false],
    [900, "optional", false, "blocked", true, false],
    [899, "optional", true, "luna_only", true, false],
    [799, "complex", true, "normal", false, true],
    [800, "complex", false, "blocked", true, false],
  ] as const)(
    "evaluates %i cents for %s",
    (monthlyCents, requestClass, allowed, mode, warning, terraEligible) => {
      expect(evaluateAiBudget(monthlyCents, requestClass)).toMatchObject({
        allowed,
        mode,
        warning,
        terraEligible,
      });
    },
  );

  it.each([
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [1.5],
    [Number.MAX_SAFE_INTEGER + 1],
  ])("fails closed for invalid monthly cents %s", (monthlyCents) => {
    expect(evaluateAiBudget(monthlyCents, "routine")).toEqual({
      allowed: false,
      mode: "blocked",
      warning: true,
      terraEligible: false,
      code: "AI_BUDGET_INVALID",
    });
  });

  it("fails closed for an unknown request class at runtime", () => {
    expect(evaluateAiBudget(0, "unknown" as never)).toEqual({
      allowed: false,
      mode: "blocked",
      warning: true,
      terraEligible: false,
      code: "AI_BUDGET_INVALID",
    });
  });

  it.each([
    ["2026-08-01T04:59:59.999Z", "2026-07"],
    ["2026-08-01T05:00:00.000Z", "2026-08"],
    ["2026-03-01T05:59:59.999Z", "2026-02"],
    ["2026-03-01T06:00:00.000Z", "2026-03"],
    ["2026-11-01T04:59:59.999Z", "2026-10"],
    ["2026-11-01T05:00:00.000Z", "2026-11"],
  ])(
    "maps %s to the America/Chicago accounting month %s",
    (timestamp, month) => {
      expect(getChicagoBudgetMonth(new Date(timestamp))).toBe(month);
    },
  );

  it("fails closed for invalid dates", () => {
    expect(() => getChicagoBudgetMonth(new Date(Number.NaN))).toThrow(
      "Invalid AI budget timestamp.",
    );
  });
});
