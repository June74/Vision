import { describe, expect, it, vi } from "vitest";
import {
  PhaseBAiUsageSourceError,
  createPhaseBAiUsageSource,
} from "../../../src/data/phase-b-ai-usage-source";

const OWNER = "owner";
const MONTH = "2026-07";

function sourceWith(row: Record<string, unknown>) {
  const execute = vi.fn(async () => ({ rows: [row] }));
  return { execute, source: createPhaseBAiUsageSource({ execute } as never, OWNER) };
}

describe("Phase B AI usage source", () => {
  it("returns only aggregate monthly settled plus reserved cents", async () => {
    const { source, execute } = sourceWith({ monthRowCount: "1", settledCents: "800", reservedCents: "150", ledgerSettledCents: "800", ledgerReservedCents: "150", ownerMonthMismatchCount: "0", invalidTransitionCount: "0" });
    await expect(source.read(MONTH)).resolves.toEqual({ monthlyCents: 950 });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("accepts a zero-row month only when its aggregate ledger totals are zero", async () => {
    await expect(sourceWith({ monthRowCount: "0", settledCents: "0", reservedCents: "0", ledgerSettledCents: "0", ledgerReservedCents: "0", ownerMonthMismatchCount: "0", invalidTransitionCount: "0" }).source.read(MONTH)).resolves.toEqual({ monthlyCents: 0 });
    await expect(sourceWith({ monthRowCount: "0", settledCents: "1", reservedCents: "0", ledgerSettledCents: "0", ledgerReservedCents: "0", ownerMonthMismatchCount: "0", invalidTransitionCount: "0" }).source.read(MONTH)).rejects.toMatchObject({ category: "inconsistent" });
  });

  it.each([
    { settledCents: "801", reservedCents: "149" },
    { ownerMonthMismatchCount: "1" },
    { invalidTransitionCount: "1" },
    { settledCents: "not-a-number" },
    { settledCents: String(Number.MAX_SAFE_INTEGER), reservedCents: "1" },
  ])("rejects inconsistent or malformed aggregate cells", async (override) => {
    const row = { monthRowCount: "1", settledCents: "800", reservedCents: "150", ledgerSettledCents: "800", ledgerReservedCents: "150", ownerMonthMismatchCount: "0", invalidTransitionCount: "0", ...override };
    await expect(sourceWith(row).source.read(MONTH)).rejects.toBeInstanceOf(PhaseBAiUsageSourceError);
  });
});
