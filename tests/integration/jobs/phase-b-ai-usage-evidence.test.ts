import { describe, expect, it, vi } from "vitest";
import {
  createPhaseBAiUsageEvidence,
  runPhaseBAiUsageEvidence,
} from "../../../src/jobs/phase-b-ai-usage-evidence";

describe("Phase B AI usage evidence", () => {
  it("emits the exact successful stopped record at 950 cents", async () => {
    const read = vi.fn(async () => ({ monthlyCents: 950 }));
    await expect(runPhaseBAiUsageEvidence(new Date("2026-07-28T00:00:00.000Z"), { read, gatewayLimitMatches: true, nonAiAvailable: true })).resolves.toEqual({ evidenceType: "vision.ai-usage/v1", outcome: "succeeded", category: "none", monthlyCents: 950, warningCents: 800, optionalStopCents: 900, hardStopCents: 950, spendTier: "stopped", gatewayLimitMatches: true, nonAiAvailable: true });
  });

  it("fails over the limit without exposing provider or ledger detail", () => {
    const evidence = createPhaseBAiUsageEvidence({ monthlyCents: 951, gatewayLimitMatches: true, nonAiAvailable: true });
    expect(evidence).toMatchObject({ outcome: "failed", category: "limit_exceeded", monthlyCents: 950 });
    expect(JSON.stringify(evidence)).not.toMatch(/reservation|provider|model|token/iu);
  });

  it("keeps deterministic non-AI availability explicit at the AI stop", () => {
    expect(createPhaseBAiUsageEvidence({ monthlyCents: 950, gatewayLimitMatches: true, nonAiAvailable: true })).toMatchObject({ outcome: "succeeded", nonAiAvailable: true });
    expect(createPhaseBAiUsageEvidence({ monthlyCents: 950, gatewayLimitMatches: false, nonAiAvailable: true })).toMatchObject({ outcome: "failed", category: "inconsistent" });
  });
});
