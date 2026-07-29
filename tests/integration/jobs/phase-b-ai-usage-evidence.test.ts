import { describe, expect, it, vi } from "vitest";
import {
  createPhaseBAiUsageEvidence,
  runPhaseBAiUsageEvidence,
} from "../../../src/jobs/phase-b-ai-usage-evidence";

describe("Phase B AI usage evidence", () => {
  it("uses the exact Chicago month key at the boundary and emits the approved stopped record", async () => {
    const read = vi.fn(async () => ({ monthlyCents: 950 }));
    await expect(runPhaseBAiUsageEvidence(new Date("2026-08-01T04:59:59.999Z"), { read, gatewayLimitMatches: true, nonAiAvailable: true })).resolves.toEqual({ evidenceType: "vision.ai-usage/v1", outcome: "succeeded", category: "none", monthlyCents: 950, warningAtCents: 800, optionalStopAtCents: 900, hardStopAtCents: 950, tier: "stopped", gatewayLimitMatches: true, nonAiAvailable: true });
    expect(read).toHaveBeenCalledWith("2026-07");
  });

  it("fails over the limit without exposing provider or ledger detail", () => {
    const evidence = createPhaseBAiUsageEvidence({ monthlyCents: 951, gatewayLimitMatches: true, nonAiAvailable: true });
    expect(evidence).toMatchObject({ outcome: "failed", category: "limit_exceeded", monthlyCents: 951 });
    expect(JSON.stringify(evidence)).not.toMatch(/reservation|provider|model|token/iu);
  });

  it("keeps deterministic non-AI availability explicit at the AI stop", () => {
    expect(createPhaseBAiUsageEvidence({ monthlyCents: 950, gatewayLimitMatches: true, nonAiAvailable: true })).toMatchObject({ outcome: "succeeded", nonAiAvailable: true });
    expect(createPhaseBAiUsageEvidence({ monthlyCents: 950, gatewayLimitMatches: false, nonAiAvailable: true })).toMatchObject({ outcome: "failed", category: "inconsistent" });
  });
});
