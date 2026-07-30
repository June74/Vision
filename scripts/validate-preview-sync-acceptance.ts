/** Pure, value-free timing checks for synchronization live acceptance. */

const INVALID = "Preview synchronization acceptance is invalid.";
const MINUTE = 60_000;
const QUARTER_HOUR = 15 * MINUTE;
const NORMAL_VISIBILITY = 120_000;
const CANONICAL_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/** Requires the exact remaining lifetime reserved for approval or edit. */
export function assertSyncSuppressionMargin(
  now: Date,
  expiresAt: string,
  stage: "before_approval" | "before_edit",
): void {
  const nowMs = instant(now);
  const expiryMs = canonicalInstant(expiresAt);
  const required =
    stage === "before_approval"
      ? 5 * MINUTE
      : stage === "before_edit"
        ? 4 * MINUTE
        : Number.NaN;
  if (!Number.isFinite(required) || expiryMs - nowMs < required) fail();
}

/** Validates direct visibility before maintenance with zero counter drift. */
export function validateNormalSyncObservation(input: {
  readonly providerCompletedAt: Date;
  readonly visibleAt: Date;
  readonly nextMaintenanceTick: Date;
  readonly retryCountDelta: number;
  readonly failureCountDelta: number;
}): { readonly elapsedMilliseconds: number } {
  const completed = instant(input.providerCompletedAt);
  const visible = instant(input.visibleAt);
  const nextTick = instant(input.nextMaintenanceTick);
  const elapsedMilliseconds = visible - completed;
  if (
    elapsedMilliseconds < 0 ||
    elapsedMilliseconds > NORMAL_VISIBILITY ||
    visible >= nextTick ||
    input.retryCountDelta !== 0 ||
    input.failureCountDelta !== 0
  ) {
    fail();
  }
  return Object.freeze({ elapsedMilliseconds });
}

/** Returns the first quarter-hour whose safe anchor is at least 15 minutes old. */
export function firstEligibleRepairTick(lastSuccessfulSyncAt: Date): Date {
  const anchor = instant(lastSuccessfulSyncAt);
  const threshold = anchor + QUARTER_HOUR;
  const tick = Math.ceil(threshold / QUARTER_HOUR) * QUARTER_HOUR;
  return new Date(tick);
}

/** Requires the recomputed first repair tick, reserved work, and next-tick visibility. */
export function validateRepairObservation(input: {
  readonly anchor: Date;
  readonly observedTick: Date;
  readonly repairOutcome: "reserved" | "no_work" | "failed";
  readonly visibleAt: Date;
  readonly retryCountDelta: number;
  readonly failureCountDelta: number;
}): void {
  const expected = firstEligibleRepairTick(input.anchor).getTime();
  const observed = instant(input.observedTick);
  const visible = instant(input.visibleAt);
  if (
    observed !== expected ||
    input.repairOutcome !== "reserved" ||
    visible < observed ||
    visible >= observed + QUARTER_HOUR ||
    input.retryCountDelta !== 0 ||
    input.failureCountDelta !== 0
  ) {
    fail();
  }
}

/** Converts a valid Date to epoch milliseconds. */
function instant(value: Date): number {
  try {
    const result = Date.prototype.getTime.call(value);
    if (Number.isFinite(result)) return result;
  } catch {
    // Fall through to one constant error.
  }
  fail();
}

/** Parses one canonical millisecond UTC instant. */
function canonicalInstant(value: unknown): number {
  if (typeof value !== "string" || !CANONICAL_INSTANT.test(value)) fail();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail();
  return parsed;
}

/** Throws the sole safe timing-validation error. */
function fail(): never {
  throw new Error(INVALID);
}
