/** Prints a privacy-safe result, optionally requiring closed restore evidence. */
import { createInterface } from "node:readline";
import {
  createSafeTailAccumulator,
  matchesPreviewAcceptanceExpectation,
  type PreviewObserverAcceptanceExpectation,
  type SafeTailResult,
} from "./safe-tail-classifier";

/** Creates a clocked signal or uniqueness observer without raw output. */
export function createPreviewTailObserver(input: {
  readonly mode: "sync_suppression_signal" | "sync_suppression_uniqueness" |
    "restore_signal" | "restore_uniqueness" | "maintenance_uniqueness";
  readonly expectation: PreviewObserverAcceptanceExpectation;
  readonly closesAt: Date;
}) {
  let terminal: SafeTailResult | null = null;
  let failed = false;
  /** Creates the fixed observer result shape. */
  const result = (done: boolean, succeeded: boolean, output: SafeTailResult | null) =>
    Object.freeze({ done, succeeded, output });
  return Object.freeze({
    /** Admits one accepting terminal. */
    push(evidence: SafeTailResult, observedAt: Date) {
      if (failed || observedAt.getTime() > input.closesAt.getTime() ||
          !matchesPreviewAcceptanceExpectation(evidence, input.expectation)) {
        failed = true;
        return result(true, false, null);
      }
      if (input.mode.endsWith("_signal")) return result(true, true, null);
      if (terminal !== null) {
        failed = true;
        return result(true, false, null);
      }
      terminal = evidence;
      return result(false, false, null);
    },
    /** Closes uniqueness only at or after the true deadline. */
    finish(now: Date) {
      if (failed || now.getTime() < input.closesAt.getTime() || terminal === null) {
        return result(true, false, null);
      }
      return result(true, true, terminal);
    },
  });
}

const RESTORE_ONLY_ARGUMENT = "--restore-only";
const RESTORE_SIGNAL_ONLY_ARGUMENT = "--restore-signal-only";
const SYNC_SUPPRESSION_ONLY_ARGUMENT = "--sync-suppression-only";
const SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT =
  "--sync-suppression-signal-only";
const ROLE_PROBE_ONLY_ARGUMENT = "--role-probe-only";
const CALENDAR_MAINTENANCE_ONLY_ARGUMENT = "--calendar-maintenance-only";
const FOUNDATION_PROBE_ONLY_ARGUMENT = "--foundation-probe-only";
const AI_USAGE_ONLY_ARGUMENT = "--ai-usage-only";
const PREVIEW_FAULT_ONLY_ARGUMENT = "--preview-fault-only";
const noArguments = process.argv.length === 2;
const restoreOnly =
  process.argv.length === 3 && process.argv[2] === RESTORE_ONLY_ARGUMENT;
const restoreSignalOnly =
  process.argv.length === 3 && process.argv[2] === RESTORE_SIGNAL_ONLY_ARGUMENT;
const syncSuppressionOnly =
  process.argv.length === 3 && process.argv[2] === SYNC_SUPPRESSION_ONLY_ARGUMENT;
const syncSuppressionSignalOnly =
  process.argv.length === 3 &&
  process.argv[2] === SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT;
const roleProbeOnly =
  process.argv.length === 3 &&
  process.argv[2] === ROLE_PROBE_ONLY_ARGUMENT;
const calendarMaintenanceOnly =
  process.argv.length === 3 &&
  process.argv[2] === CALENDAR_MAINTENANCE_ONLY_ARGUMENT;
const foundationProbeOnly =
  process.argv.length === 3 &&
  process.argv[2] === FOUNDATION_PROBE_ONLY_ARGUMENT;
const aiUsageOnly = process.argv.length === 3 && process.argv[2] === AI_USAGE_ONLY_ARGUMENT;
const previewFaultOnly =
  process.argv.length === 3 && process.argv[2] === PREVIEW_FAULT_ONLY_ARGUMENT;
if (
  !noArguments &&
  !restoreOnly &&
  !restoreSignalOnly &&
  !syncSuppressionOnly &&
  !syncSuppressionSignalOnly &&
  !roleProbeOnly &&
  !calendarMaintenanceOnly &&
  !foundationProbeOnly &&
  !aiUsageOnly &&
  !previewFaultOnly
) {
  process.exit(1);
}
let emitted = false;
const accumulator = createSafeTailAccumulator();
const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  const evidence = accumulator.push(line);
  if (
    !evidence ||
    emitted ||
    (restoreOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-restore/v1")) ||
    (restoreSignalOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-restore/v1")) ||
    ((syncSuppressionOnly || syncSuppressionSignalOnly) &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.sync-suppression/v1")) ||
    (roleProbeOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-role-probe/v1")) ||
    (calendarMaintenanceOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.calendar-maintenance/v2")) ||
    (foundationProbeOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !==
          "vision.phase-b-foundation-probe/v1")) ||
    (aiUsageOnly && (!("evidenceType" in evidence) || evidence.evidenceType !== "vision.ai-usage/v1")) ||
    (previewFaultOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-fault/v1"))
  ) {
    return;
  }
  emitted = true;
  if (restoreSignalOnly || syncSuppressionSignalOnly) {
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  process.exit(0);
});

lines.on("close", () => {
  if (!emitted) {
    process.stdout.write(
      '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    );
  }
});
