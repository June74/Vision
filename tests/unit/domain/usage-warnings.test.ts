import { describe, expect, it } from "vitest";
import {
  calculateUsageWarnings,
  type UsageMeasurements,
  type UsageWarningThresholds,
} from "../../../src/domain/operations/usage-warnings";

const thresholds: UsageWarningThresholds = {
  databaseBytes: 400_000_000,
  r2Bytes: 8_000_000_000,
  r2ObjectCount: 100,
};

function measurements(
  overrides: Partial<UsageMeasurements> = {},
): UsageMeasurements {
  return {
    databaseBytes: 0,
    r2Bytes: 0,
    r2ObjectCount: 0,
    ...overrides,
  };
}

describe("usage warning policy", () => {
  it.each([
    [399_999_999, false],
    [400_000_000, true],
    [400_000_001, true],
  ])("classifies database bytes %s at the approved boundary", (databaseBytes, expected) => {
    expect(
      calculateUsageWarnings(measurements({ databaseBytes }), thresholds)
        .databaseUsageWarning,
    ).toBe(expected);
  });

  it.each([
    [7_999_999_999, false],
    [8_000_000_000, true],
    [8_000_000_001, true],
  ])("classifies R2 bytes %s at the approved boundary", (r2Bytes, expected) => {
    expect(
      calculateUsageWarnings(measurements({ r2Bytes }), thresholds)
        .r2UsageWarning,
    ).toBe(expected);
  });

  it.each([
    [99, false],
    [100, true],
    [101, true],
  ])("classifies R2 objects %s at the approved boundary", (r2ObjectCount, expected) => {
    expect(
      calculateUsageWarnings(measurements({ r2ObjectCount }), thresholds)
        .r2UsageWarning,
    ).toBe(expected);
  });

  it.each([
    ["negative", { databaseBytes: -1 }],
    ["fractional", { r2Bytes: 1.5 }],
    ["unsafe", { r2ObjectCount: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects %s measurements", (_, invalid) => {
    expect(() =>
      calculateUsageWarnings(measurements(invalid), thresholds),
    ).toThrow("Invalid usage measurements.");
  });

  it("rejects non-positive, fractional, and unsafe thresholds", () => {
    for (const invalid of [
      { ...thresholds, databaseBytes: 0 },
      { ...thresholds, r2Bytes: 1.5 },
      { ...thresholds, r2ObjectCount: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(() =>
        calculateUsageWarnings(measurements(), invalid),
      ).toThrow("Invalid usage warning thresholds.");
    }
  });
});
