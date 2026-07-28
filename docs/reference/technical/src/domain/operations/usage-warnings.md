# `src/domain/operations/usage-warnings.ts`

Defines `UsageMeasurements`, `UsageWarnings`, `UsageWarningSource`, and
`UsageWarningThresholds` as the identity-free diagnostic contract.

## `calculateUsageWarnings`

**Signature:** `(measurements: UsageMeasurements, thresholds: UsageWarningThresholds) => UsageWarnings`

This deterministic domain boundary validates safe-integer inputs before using
inclusive comparisons. `databaseUsageWarning` is
`databaseBytes >= thresholds.databaseBytes`. `r2UsageWarning` is true when
either R2 bytes or admitted object count reaches its threshold. The returned
record is frozen.

## `isNonnegativeSafeInteger`

Rejects negative, fractional, non-number, and unsafe measurement values before
policy comparison.

## `isPositiveSafeInteger`

Rejects zero in addition to every invalid measurement form when validating
thresholds.
