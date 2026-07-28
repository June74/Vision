/** Aggregate storage measurements admitted by the server-only diagnostics source. */
export interface UsageMeasurements {
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}

/** Actionable storage warning flags exposed by the authenticated diagnostics route. */
export interface UsageWarnings {
  readonly databaseUsageWarning: boolean;
  readonly r2UsageWarning: boolean;
}

/** Server-only source that measures storage without exposing provider details. */
export interface UsageWarningSource {
  readUsageWarnings(): Promise<UsageWarnings>;
}

/** Positive thresholds injected from the deployable environment. */
export interface UsageWarningThresholds {
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}

/** Applies the complete storage-warning threshold policy without provider access. */
export function calculateUsageWarnings(
  measurements: UsageMeasurements,
  thresholds: UsageWarningThresholds,
): UsageWarnings {
  if (
    !isNonnegativeSafeInteger(measurements.databaseBytes) ||
    !isNonnegativeSafeInteger(measurements.r2ObjectCount) ||
    !isNonnegativeSafeInteger(measurements.r2Bytes)
  ) {
    throw new Error("Invalid usage measurements.");
  }
  if (
    !isPositiveSafeInteger(thresholds.databaseBytes) ||
    !isPositiveSafeInteger(thresholds.r2ObjectCount) ||
    !isPositiveSafeInteger(thresholds.r2Bytes)
  ) {
    throw new Error("Invalid usage warning thresholds.");
  }
  return Object.freeze({
    databaseUsageWarning:
      measurements.databaseBytes >= thresholds.databaseBytes,
    r2UsageWarning:
      measurements.r2ObjectCount >= thresholds.r2ObjectCount ||
      measurements.r2Bytes >= thresholds.r2Bytes,
  });
}

/** Reports whether a measurement can participate in bounded integer comparison. */
function isNonnegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Reports whether an injected threshold is a usable positive integer. */
function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
