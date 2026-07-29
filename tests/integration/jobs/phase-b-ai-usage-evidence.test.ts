import { describe, expect, it, vi } from "vitest";
import {
  createPhaseBAiUsageEvidence,
  runPhaseBAiUsageEvidence,
} from "../../../src/jobs/phase-b-ai-usage-evidence";

describe("Phase B AI usage evidence", () => {
  it("uses the Chicago month and proves both non-AI reads at the hard stop", async () => {
    const read = vi.fn(async () => ({ monthlyCents: 950 }));
    const readStatus = vi.fn(async () => undefined);
    const readCalendar = vi.fn(async () => undefined);

    await expect(
      runPhaseBAiUsageEvidence(
        new Date("2026-08-01T04:59:59.999Z"),
        {
          read,
          gatewayLimitMatches: true,
          readStatus,
          readCalendar,
        },
      ),
    ).resolves.toEqual({
      evidenceType: "vision.ai-usage/v1",
      outcome: "succeeded",
      category: "none",
      monthlyCents: 950,
      warningAtCents: 800,
      optionalStopAtCents: 900,
      hardStopAtCents: 950,
      tier: "stopped",
      gatewayLimitMatches: true,
      nonAiAvailable: true,
    });
    expect(read).toHaveBeenCalledWith("2026-07");
    expect(readStatus).toHaveBeenCalledOnce();
    expect(readCalendar).toHaveBeenCalledOnce();
  });

  it("fails over the limit without exposing provider or ledger detail", () => {
    const evidence = createPhaseBAiUsageEvidence({
      monthlyCents: 951,
      gatewayLimitMatches: true,
      nonAiAvailable: true,
    });
    expect(evidence).toMatchObject({
      outcome: "failed",
      category: "limit_exceeded",
      monthlyCents: 951,
    });
    expect(JSON.stringify(evidence)).not.toMatch(
      /reservation|provider|model|token/iu,
    );
  });

  it("requires the attested Gateway limit and proven non-AI path", () => {
    expect(
      createPhaseBAiUsageEvidence({
        monthlyCents: 950,
        gatewayLimitMatches: true,
        nonAiAvailable: true,
      }),
    ).toMatchObject({ outcome: "succeeded", nonAiAvailable: true });
    expect(
      createPhaseBAiUsageEvidence({
        monthlyCents: 950,
        gatewayLimitMatches: false,
        nonAiAvailable: true,
      }),
    ).toMatchObject({ outcome: "failed", category: "inconsistent" });
  });

  it("fails closed when either deterministic non-AI read is unavailable", async () => {
    const readCalendar = vi.fn(async () => undefined);
    const evidence = await runPhaseBAiUsageEvidence(
      new Date("2026-07-25T17:00:00.000Z"),
      {
        read: vi.fn(async () => ({ monthlyCents: 950 })),
        gatewayLimitMatches: true,
        readStatus: vi.fn(async () => {
          throw new Error("safe test failure");
        }),
        readCalendar,
      },
    );

    expect(evidence).toMatchObject({
      outcome: "failed",
      category: "unavailable",
      nonAiAvailable: false,
    });
    expect(readCalendar).not.toHaveBeenCalled();
  });
});
