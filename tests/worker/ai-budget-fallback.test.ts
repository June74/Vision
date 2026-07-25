import { describe, expect, it } from "vitest";
import {
  evaluateFoundationCapability,
  type FoundationCapability,
} from "../../src/domain/budget/ai-budget";

describe("AI budget foundation fallback contract", () => {
  it("keeps every non-AI foundation response usable at the 950-cent hard stop", () => {
    const nonAiCapabilities: FoundationCapability[] = [
      "calendar_event_listing",
      "sync_status",
      "category_correction",
      "template_diagnostics",
    ];

    for (const capability of nonAiCapabilities) {
      expect(evaluateFoundationCapability(950, capability)).toEqual({
        allowed: true,
        status: 200,
      });
    }
  });

  it("blocks only the AI proposal response at the hard stop", () => {
    expect(evaluateFoundationCapability(950, "ai_proposal")).toEqual({
      allowed: false,
      status: 503,
      code: "AI_BUDGET_EXHAUSTED",
    });
  });
});
