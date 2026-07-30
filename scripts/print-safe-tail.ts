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

/** Creates a clocked signal or uniqueness observer without raw output. */
export function createPreviewTailObserver(input: {
  readonly mode: "accepting_signal" | "sync_suppression_signal" |
    "sync_suppression_uniqueness" | "restore_signal" |
    "restore_uniqueness" | "maintenance_uniqueness";
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
const OBSERVER_MODES = Object.freeze([
  RESTORE_ONLY_ARGUMENT,
  RESTORE_SIGNAL_ONLY_ARGUMENT,
  SYNC_SUPPRESSION_ONLY_ARGUMENT,
  SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT,
  ROLE_PROBE_ONLY_ARGUMENT,
  CALENDAR_MAINTENANCE_ONLY_ARGUMENT,
  FOUNDATION_PROBE_ONLY_ARGUMENT,
  AI_USAGE_ONLY_ARGUMENT,
  PREVIEW_FAULT_ONLY_ARGUMENT,
] as const);
type ObserverModeArgument = (typeof OBSERVER_MODES)[number];
type TailObserverMode = Parameters<typeof createPreviewTailObserver>[0]["mode"];
interface ObserverConfiguration {
  readonly mode: TailObserverMode;
  readonly expectation: PreviewObserverAcceptanceExpectation;
  readonly closesAt: Date;
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
const TERMINAL_MARKERS = Object.freeze([
  "vision.sync-suppression/v1",
  "vision.phase-b-foundation-probe/v1",
  "vision.preview-fault/v1",
  "vision.preview-role-probe/v1",
  "vision.preview-restore/v1",
  "vision.calendar-maintenance/v2",
  "vision.ai-usage/v1",
]);

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
      !["--expectation", "--closes-at", "--scenario",
        "--maintenance-scheduled-at"].includes(flag ?? "") ||
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
  const closesAtValue = values.get("--closes-at");
  if (
    !expectationKind ||
    !EXPECTATIONS.includes(expectationKind) ||
    !isCanonicalInstant(closesAtValue)
  ) {
    throw new Error("invalid");
  }
  const closesAt = new Date(closesAtValue);
  let expectation: PreviewObserverAcceptanceExpectation;
  let observerMode: TailObserverMode;
  let outputSignalEvidence = true;
  switch (mode) {
    case RESTORE_ONLY_ARGUMENT:
      if (expectationKind !== "restore_succeeded" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "restore_succeeded" };
      observerMode = "restore_uniqueness";
      outputSignalEvidence = false;
      break;
    case RESTORE_SIGNAL_ONLY_ARGUMENT:
      if (expectationKind !== "restore_succeeded" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "restore_succeeded" };
      observerMode = "restore_signal";
      outputSignalEvidence = false;
      break;
    case SYNC_SUPPRESSION_ONLY_ARGUMENT:
      if (expectationKind !== "sync_suppressed" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "sync_suppressed" };
      observerMode = "sync_suppression_uniqueness";
      outputSignalEvidence = false;
      break;
    case SYNC_SUPPRESSION_SIGNAL_ONLY_ARGUMENT:
      if (expectationKind !== "sync_suppressed" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "sync_suppressed" };
      observerMode = "sync_suppression_signal";
      outputSignalEvidence = false;
      break;
    case ROLE_PROBE_ONLY_ARGUMENT:
      if (expectationKind !== "role_probe_succeeded" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "role_probe_succeeded" };
      observerMode = "accepting_signal";
      break;
    case FOUNDATION_PROBE_ONLY_ARGUMENT:
      if (expectationKind !== "foundation_succeeded" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "foundation_succeeded" };
      observerMode = "accepting_signal";
      break;
    case AI_USAGE_ONLY_ARGUMENT:
      if (expectationKind !== "ai_succeeded" || values.size !== 2) {
        throw new Error("invalid");
      }
      expectation = { kind: "ai_succeeded" };
      observerMode = "accepting_signal";
      break;
    case PREVIEW_FAULT_ONLY_ARGUMENT: {
      const scenario = values.get("--scenario") as
        | TemporaryPreviewFaultScenario
        | undefined;
      if (
        expectationKind !== "fault_expected" ||
        values.size !== 3 ||
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
        values.size !== 3 ||
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
    closesAt,
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
function isRejectedTerminalEvent(line: string): boolean {
  try {
    JSON.parse(line);
  } catch {
    return false;
  }
  return TERMINAL_MARKERS.some((marker) => line.includes(marker));
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
  ) => {
    if (completed) return;
    completed = true;
    if (timer) clearTimeout(timer);
    if (succeeded && evidence) {
      process.stdout.write(`${JSON.stringify(evidence)}\n`);
    }
    process.exitCode = succeeded ? 0 : 1;
    lines.close();
    process.stdin.destroy();
  };
  const delay = configuration.closesAt.getTime() - Date.now();
  if (delay <= 0) {
    complete(false);
    return;
  }
  if (!configuration.mode.endsWith("_signal")) {
    timer = setTimeout(() => {
      const result = observer.finish(new Date());
      complete(result.succeeded, result.output);
    }, delay);
  }
  lines.on("line", (line) => {
    if (completed) return;
    const evidence = accumulator.push(line);
    if (!evidence) {
      if (isRejectedTerminalEvent(line)) complete(false);
      return;
    }
    if (!("evidenceType" in evidence)) return;
    const result = observer.push(evidence, new Date());
    if (result.done) {
      complete(
        result.succeeded,
        result.succeeded && configuration.outputSignalEvidence
          ? evidence
          : result.output,
      );
    }
  });
  lines.on("close", () => {
    if (completed) return;
    const result = observer.finish(new Date());
    complete(result.succeeded, result.output);
  });
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
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
