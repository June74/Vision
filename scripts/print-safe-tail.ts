/** Prints a privacy-safe result, optionally requiring closed restore evidence. */
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createSafeTailAccumulator,
  matchesPreviewAcceptanceExpectation,
  type PreviewObserverAcceptanceExpectation,
  type SafeTailResult,
} from "./safe-tail-classifier";
import {
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  type TemporaryPreviewFaultScenario,
} from "../src/domain/operations/temporary-preview-fault";
import {
  PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES,
  type PreviewTailObserverFailureCategory,
} from "./preview-tail-observer-dialect";

/** Emits one fixed diagnosis only when the supervisor explicitly requests it. */
function emitObserverFailure(
  category: PreviewTailObserverFailureCategory,
  onFlushed: () => void,
): void {
  if (!PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES.includes(category)) {
    onFlushed();
    return;
  }
  if (process.env.PREVIEW_TAIL_DIAGNOSTIC !== "1") {
    onFlushed();
    return;
  }
  process.stderr.write(
    `Preview tail observer failed closed: ${category}.\n`,
    onFlushed,
  );
}

/** Converts uncaught observer failures into one fixed, value-free category. */
function handleObserverRuntimeFailure(): void {
  emitObserverFailure("observer_runtime_error", () => {
    process.exitCode = 1;
  });
}

/** Classifies one semantic maintenance mismatch without exposing field values. */
function classifyExpectationFailure(
  evidence: SafeTailResult,
  expectation: PreviewObserverAcceptanceExpectation,
): PreviewTailObserverFailureCategory {
  if (
    (expectation.kind === "maintenance_succeeded" ||
      expectation.kind === "maintenance_repair_reserved") &&
    evidence !== null &&
    typeof evidence === "object"
  ) {
    const candidate = evidence as unknown as Record<string, unknown>;
    if (
      candidate.maintenanceScheduledAt !== expectation.maintenanceScheduledAt
    ) {
      return "maintenance_schedule_mismatch";
    }
    if (candidate.outcome !== "succeeded") {
      return "maintenance_outcome_mismatch";
    }
    if (candidate.category !== "none") {
      return "maintenance_category_mismatch";
    }
    if (candidate.repairOutcome === "failed") {
      return "maintenance_repair_failure";
    }
    if (candidate.renewalOutcome === "failed") {
      return "maintenance_renewal_failure";
    }
    if (
      expectation.kind === "maintenance_repair_reserved" &&
      candidate.repairOutcome !== "reserved"
    ) {
      return "maintenance_repair_not_reserved";
    }
  }
  return "evidence_rejected_by_expectation";
}

/** Creates a clocked signal or uniqueness observer without raw output. */
export function createPreviewTailObserver(input: {
  readonly mode: "accepting_signal" | "sync_suppression_signal" |
    "sync_suppression_uniqueness" | "restore_signal" |
    "restore_uniqueness" | "maintenance_uniqueness" |
    "ai_usage_signal" | "ai_usage_uniqueness";
  readonly expectation: PreviewObserverAcceptanceExpectation;
  readonly expiresAt?: Date;
}) {
  let terminal: SafeTailResult | null = null;
  const aiExpiresAt =
    input.mode === "ai_usage_uniqueness"
      ? copyValidDate(input.expiresAt)
      : null;
  let uniquenessClosesAt: Date | null =
    aiExpiresAt !== null
      ? copyValidDate(new Date(aiExpiresAt.getTime() + 180_000))
      : input.mode === "maintenance_uniqueness" &&
      (input.expectation.kind === "maintenance_succeeded" ||
        input.expectation.kind === "maintenance_repair_reserved")
      ? new Date(
          Date.parse(input.expectation.maintenanceScheduledAt) + 120_000,
        )
      : null;
  let failed = false;
  /** Creates the fixed observer result shape. */
  const result = (done: boolean, succeeded: boolean, output: SafeTailResult | null) =>
    Object.freeze({ done, succeeded, output });
  return Object.freeze({
    /** Admits one accepting terminal. */
    push(evidence: SafeTailResult, observedAt: Date) {
      if (
        failed ||
        (aiExpiresAt !== null &&
          observedAt.getTime() > aiExpiresAt.getTime()) ||
        (uniquenessClosesAt !== null &&
          observedAt.getTime() > uniquenessClosesAt.getTime()) ||
        !matchesPreviewAcceptanceExpectation(evidence, input.expectation)
      ) {
        failed = true;
        return result(true, false, null);
      }
      if (input.mode.endsWith("_signal")) {
        return result(
          true,
          true,
          input.mode === "accepting_signal" ? evidence : null,
        );
      }
      if (terminal !== null) {
        failed = true;
        return result(true, false, null);
      }
      terminal = evidence;
      if (uniquenessClosesAt === null) {
        uniquenessClosesAt = new Date(observedAt.getTime() + 120_000);
      }
      return result(false, false, null);
    },
    /** Closes uniqueness only at or after the true deadline. */
    finish(now: Date) {
      if (
        failed ||
        uniquenessClosesAt === null ||
        now.getTime() < uniquenessClosesAt.getTime() ||
        terminal === null
      ) {
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
const AI_USAGE_SIGNAL_ONLY_ARGUMENT = "--ai-usage-signal-only";
const PREVIEW_FAULT_ONLY_ARGUMENT = "--preview-fault-only";
const OBSERVER_MODES = Object.freeze([
  RESTORE_ONLY_ARGUMENT,
  RESTORE_SIGNAL_ONLY_ARGUMENT,
  SYNC_SUPPRESSION_ONLY_ARGUMENT,
  SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT,
  ROLE_PROBE_ONLY_ARGUMENT,
  CALENDAR_MAINTENANCE_ONLY_ARGUMENT,
  FOUNDATION_PROBE_ONLY_ARGUMENT,
  AI_USAGE_ONLY_ARGUMENT,
  AI_USAGE_SIGNAL_ONLY_ARGUMENT,
  PREVIEW_FAULT_ONLY_ARGUMENT,
] as const);
type ObserverModeArgument = (typeof OBSERVER_MODES)[number];
type TailObserverMode = Parameters<typeof createPreviewTailObserver>[0]["mode"];
interface ObserverConfiguration {
  readonly mode: TailObserverMode;
  readonly expectation: PreviewObserverAcceptanceExpectation;
  readonly closesAt?: Date;
  readonly expiresAt?: Date;
  readonly outputSignalEvidence: boolean;
}
const EXPECTATIONS = Object.freeze([
  "sync_suppressed",
  "foundation_succeeded",
  "fault_expected",
  "role_probe_succeeded",
  "restore_succeeded",
  "maintenance_succeeded",
  "maintenance_repair_reserved",
  "ai_succeeded",
] as const);
type ExpectationKind = (typeof EXPECTATIONS)[number];
/** Parses one strict, output-free observer command. */
function parseObserverConfiguration(
  arguments_: readonly string[],
): ObserverConfiguration {
  const mode = arguments_[0] as ObserverModeArgument | undefined;
  if (!mode || !OBSERVER_MODES.includes(mode)) throw new Error("invalid");
  const values = new Map<string, string>();
  for (let index = 1; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (
      value === undefined ||
      !["--expectation", "--scenario",
        "--maintenance-scheduled-at", "--expires-at"].includes(flag ?? "") ||
      values.has(flag!) ||
      value.length === 0
    ) {
      throw new Error("invalid");
    }
    values.set(flag!, value);
  }
  const expectationKind = values.get("--expectation") as
    | ExpectationKind
    | undefined;
  if (!expectationKind || !EXPECTATIONS.includes(expectationKind)) {
    throw new Error("invalid");
  }
  let expectation: PreviewObserverAcceptanceExpectation;
  let observerMode: TailObserverMode;
  let outputSignalEvidence = true;
  switch (mode) {
    case RESTORE_ONLY_ARGUMENT:
      if (expectationKind !== "restore_succeeded" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "restore_succeeded" };
      observerMode = "restore_uniqueness";
      outputSignalEvidence = false;
      break;
    case RESTORE_SIGNAL_ONLY_ARGUMENT:
      if (expectationKind !== "restore_succeeded" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "restore_succeeded" };
      observerMode = "restore_signal";
      outputSignalEvidence = false;
      break;
    case SYNC_SUPPRESSION_ONLY_ARGUMENT:
      if (expectationKind !== "sync_suppressed" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "sync_suppressed" };
      observerMode = "sync_suppression_uniqueness";
      outputSignalEvidence = false;
      break;
    case SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT:
      if (expectationKind !== "sync_suppressed" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "sync_suppressed" };
      observerMode = "sync_suppression_signal";
      outputSignalEvidence = false;
      break;
    case ROLE_PROBE_ONLY_ARGUMENT:
      if (expectationKind !== "role_probe_succeeded" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "role_probe_succeeded" };
      observerMode = "accepting_signal";
      break;
    case FOUNDATION_PROBE_ONLY_ARGUMENT:
      if (expectationKind !== "foundation_succeeded" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "foundation_succeeded" };
      observerMode = "accepting_signal";
      break;
    case AI_USAGE_ONLY_ARGUMENT:
      if (
        expectationKind !== "ai_succeeded" ||
        values.size !== 2 ||
        !isCanonicalInstant(values.get("--expires-at"))
      ) {
        throw new Error("invalid");
      }
      expectation = { kind: "ai_succeeded" };
      observerMode = "ai_usage_uniqueness";
      outputSignalEvidence = false;
      break;
    case AI_USAGE_SIGNAL_ONLY_ARGUMENT:
      if (expectationKind !== "ai_succeeded" || values.size !== 1) {
        throw new Error("invalid");
      }
      expectation = { kind: "ai_succeeded" };
      observerMode = "ai_usage_signal";
      outputSignalEvidence = false;
      break;
    case PREVIEW_FAULT_ONLY_ARGUMENT: {
      const scenario = values.get("--scenario") as
        | TemporaryPreviewFaultScenario
        | undefined;
      if (
        expectationKind !== "fault_expected" ||
        values.size !== 2 ||
        !scenario ||
        !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(scenario)
      ) {
        throw new Error("invalid");
      }
      expectation = { kind: "fault_expected", scenario };
      observerMode = "accepting_signal";
      break;
    }
    case CALENDAR_MAINTENANCE_ONLY_ARGUMENT: {
      const scheduledAt = values.get("--maintenance-scheduled-at");
      if (
        (expectationKind !== "maintenance_succeeded" &&
          expectationKind !== "maintenance_repair_reserved") ||
        values.size !== 2 ||
        !isCanonicalInstant(scheduledAt)
      ) {
        throw new Error("invalid");
      }
      expectation = {
        kind: expectationKind,
        maintenanceScheduledAt: scheduledAt,
      };
      observerMode = "maintenance_uniqueness";
      outputSignalEvidence = false;
      break;
    }
  }
  return Object.freeze({
    mode: observerMode,
    expectation,
    ...(observerMode === "maintenance_uniqueness"
      ? {
          closesAt: new Date(
            Date.parse(
              (expectation as Extract<
                PreviewObserverAcceptanceExpectation,
                {
                  readonly kind:
                    | "maintenance_succeeded"
                    | "maintenance_repair_reserved";
                }
              >).maintenanceScheduledAt,
            ) + 120_000,
          ),
        }
      : observerMode === "ai_usage_uniqueness"
      ? {
          closesAt: new Date(
            Date.parse(values.get("--expires-at")!) + 180_000,
          ),
        }
      : {}),
    ...(observerMode === "ai_usage_uniqueness"
      ? { expiresAt: new Date(Date.parse(values.get("--expires-at")!)) }
      : {}),
    outputSignalEvidence,
  });
}

/** Recognizes one byte-canonical millisecond UTC instant. */
function isCanonicalInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/** Detects a complete target-shaped event that the classifier rejected. */
function isRejectedTerminalEvent(
  line: string,
  expectation: PreviewObserverAcceptanceExpectation,
): boolean {
  try {
    JSON.parse(line);
  } catch {
    return false;
  }
  const expectedMarker = expectedEvidenceType(expectation);
  return expectedMarker !== null && line.includes(expectedMarker);
}

/** Returns the one terminal evidence family admitted by an expectation. */
function expectedEvidenceType(
  expectation: PreviewObserverAcceptanceExpectation,
): string | null {
  switch (expectation.kind) {
    case "sync_suppressed":
      return "vision.sync-suppression/v1";
    case "foundation_succeeded":
      return "vision.phase-b-foundation-probe/v1";
    case "fault_expected":
      return "vision.preview-fault/v1";
    case "role_probe_succeeded":
      return "vision.preview-role-probe/v1";
    case "restore_succeeded":
      return "vision.preview-restore/v1";
    case "maintenance_succeeded":
    case "maintenance_repair_reserved":
      return "vision.calendar-maintenance/v2";
    case "ai_succeeded":
      return "vision.ai-usage/v1";
  }
}

/** Ignores valid terminal evidence from another scheduled acceptance family. */
function isExpectedEvidence(
  evidence: SafeTailResult,
  expectation: PreviewObserverAcceptanceExpectation,
): boolean {
  const expectedType = expectedEvidenceType(expectation);
  if (
    expectedType === null ||
    typeof evidence !== "object" ||
    evidence === null
  ) {
    return false;
  }
  return "evidenceType" in evidence && evidence.evidenceType === expectedType;
}

/** Runs the legacy non-observer filter used by recovery diagnostics. */
function runLegacyTail(): void {
  let emitted = false;
  const accumulator = createSafeTailAccumulator();
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on("line", (line) => {
    const evidence = accumulator.push(line);
    if (!evidence || emitted) return;
    emitted = true;
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    lines.close();
  });
  lines.on("close", () => {
    if (!emitted) {
      process.stdout.write(
        '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
      );
    }
  });
}

/** Runs a signal or uniqueness observer without rendering rejected input. */
function runObserverTail(configuration: ObserverConfiguration): void {
  const accumulator = createSafeTailAccumulator();
  const observer = createPreviewTailObserver(configuration);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let completed = false;
  let timer: NodeJS.Timeout | undefined;
  /** Closes the process with only allowlisted evidence, when applicable. */
  const complete = (
    succeeded: boolean,
    evidence: SafeTailResult | null = null,
    failureCategory?: PreviewTailObserverFailureCategory,
  ) => {
    if (completed) return;
    completed = true;
    if (timer) clearTimeout(timer);
    if (succeeded && evidence) {
      process.stdout.write(`${JSON.stringify(evidence)}\n`);
    }
    /** Finalizes exit state after any fixed diagnostic write is flushed. */
    const finish = () => {
      process.exitCode = succeeded ? 0 : 1;
      lines.close();
      process.stdin.destroy();
    };
    if (!succeeded && failureCategory !== undefined) {
      emitObserverFailure(failureCategory, finish);
      return;
    }
    finish();
  };
  if (configuration.closesAt !== undefined) {
    const delay = configuration.closesAt.getTime() - Date.now();
    if (
      delay <= 0 ||
      (configuration.mode === "ai_usage_uniqueness" &&
        delay > 63 * 60_000)
    ) {
      complete(false, null, "observer_window_invalid");
      return;
    }
    timer = setTimeout(() => {
      const result = observer.finish(new Date());
      complete(
        result.succeeded,
        result.output,
        result.succeeded ? undefined : "observer_no_matching_evidence",
      );
    }, delay);
  }
  lines.on("line", (line) => {
    if (completed) return;
    const evidence = accumulator.push(line);
    if (!evidence) {
      if (isRejectedTerminalEvent(line, configuration.expectation)) {
        complete(false, null, "rejected_terminal_event");
      }
      return;
    }
    if (!isExpectedEvidence(evidence, configuration.expectation)) return;
    if (!("evidenceType" in evidence)) return;
    const observedAt = new Date();
    const result = observer.push(evidence, observedAt);
    if (
      !result.done &&
      timer === undefined &&
      !configuration.mode.endsWith("_signal")
    ) {
      timer = setTimeout(() => {
        const finished = observer.finish(new Date());
        complete(
          finished.succeeded,
          finished.output,
          finished.succeeded ? undefined : "observer_uniqueness_failed",
        );
      }, 120_000);
    }
    if (result.done) {
      complete(
        result.succeeded,
        result.succeeded && configuration.outputSignalEvidence
          ? evidence
          : result.output,
        result.succeeded
          ? undefined
          : classifyExpectationFailure(evidence, configuration.expectation),
      );
    }
  });
  lines.on("close", () => {
    if (completed) return;
    const result = observer.finish(new Date());
    complete(
      result.succeeded,
      result.output,
      result.succeeded ? undefined : "input_closed_before_evidence",
    );
  });
}

/** Copies one valid Date without retaining caller-owned mutable state. */
function copyValidDate(value: unknown): Date {
  if (!(value instanceof Date)) throw new Error("invalid");
  const milliseconds = Date.prototype.getTime.call(value);
  if (!Number.isFinite(milliseconds)) throw new Error("invalid");
  return new Date(milliseconds);
}

/** Parses and runs the executable without a free-form error surface. */
function main(): void {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length === 0) {
    runLegacyTail();
    return;
  }
  try {
    runObserverTail(parseObserverConfiguration(arguments_));
  } catch {
    emitObserverFailure("invalid_configuration", () => {
      process.exitCode = 1;
    });
  }
}

process.on("uncaughtException", handleObserverRuntimeFailure);
process.on("unhandledRejection", handleObserverRuntimeFailure);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
