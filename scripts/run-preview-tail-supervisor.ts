/** Supervises one raw tail producer behind the privacy-safe observer process. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FAILURE = "Preview tail supervision failed closed.";
const MAX_CAPTURE_BYTES = 65_536;
const moduleRequire = createRequire(import.meta.url);

/** Fixed categories for privacy-safe diagnosis of a failed tail boundary. */
export type PreviewTailFailureCategory =
  | "producer_error"
  | "producer_closed_before_consumer_success"
  | "consumer_error"
  // Nonzero exit with nothing on stderr: the observer died before it could
  // name a category. Distinct from a category we simply do not recognise.
  | "consumer_silent"
  | "consumer_unrecognised"
  | "consumer_signal"
  | "consumer_invalid_configuration"
  | "consumer_observer_window_invalid"
  | "consumer_observer_no_matching_evidence"
  | "consumer_rejected_terminal_event"
  | "consumer_evidence_rejected_by_expectation"
  | "consumer_observer_uniqueness_failed"
  | "consumer_observer_runtime_error"
  | "consumer_input_closed_before_evidence"
  | "capture_overflow"
  | "producer_unavailable"
  | "termination_failure";

/** Lifecycle facts that are safe to report: an exit status and an ordering. */
export interface PreviewTailFailureDetail {
  /** Null when the consumer never closed on its own, e.g. we terminated it. */
  readonly consumerExitCode?: number | null;
  readonly producerClosedFirst?: boolean;
}

/** Carries only a fixed failure category; child/provider output never crosses this boundary. */
export class PreviewTailSupervisionError extends Error {
  readonly category: PreviewTailFailureCategory;
  readonly consumerExitCode: number | null;
  readonly producerClosedFirst: boolean;

  constructor(
    category: PreviewTailFailureCategory,
    detail: PreviewTailFailureDetail = {},
  ) {
    super(FAILURE);
    this.name = "PreviewTailSupervisionError";
    this.category = category;
    this.consumerExitCode = detail.consumerExitCode ?? null;
    this.producerClosedFirst = detail.producerClosedFirst ?? false;
  }
}

export interface PreviewTailChildCommand {
  readonly executable: string;
  readonly arguments: readonly string[];
}

export interface PreviewTailSupervisorResult {
  readonly stdout: string;
  readonly producerTermination: "deliberate";
}

export interface PreviewTailCommandPlan {
  readonly producer: PreviewTailChildCommand;
  readonly consumer: PreviewTailChildCommand;
}

/** Builds the shell-free commands used by the production CLI entrypoint. */
export function createDefaultPreviewTailCommandPlan(
  forwardedArguments: readonly string[],
): PreviewTailCommandPlan {
  const wranglerManifest = moduleRequire.resolve("wrangler/package.json");
  const wranglerBin = resolve(
    dirname(wranglerManifest),
    "bin",
    "wrangler.js",
  );
  const tsxCli = moduleRequire.resolve("tsx/cli");
  const safeTailScript = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "print-safe-tail.ts",
  );
  return Object.freeze({
    producer: validateCommand({
      executable: process.execPath,
      arguments: [
        wranglerBin,
        "tail",
        "vision-preview",
        "--format",
        "json",
      ],
    }),
    consumer: validateCommand({
      executable: process.execPath,
      arguments: [tsxCli, safeTailScript, ...forwardedArguments],
    }),
  });
}

interface PreviewTailSupervisorDependencies {
  readonly waitForChildClose?: (
    child: ChildProcessWithoutNullStreams,
  ) => Promise<void>;
}

/** Runs two argument-array children and owns the producer's successful teardown. */
export function supervisePreviewTail(input: {
  readonly producer: PreviewTailChildCommand;
  readonly consumer: PreviewTailChildCommand;
}, dependencies: PreviewTailSupervisorDependencies = {}): Promise<PreviewTailSupervisorResult> {
  const producerCommand = validateCommand(input.producer);
  const consumerCommand = validateCommand(input.consumer);
  const awaitChildClose =
    dependencies.waitForChildClose ?? waitForChildClose;
  const consumer = spawnCommand(consumerCommand, {
    PREVIEW_TAIL_DIAGNOSTIC: "1",
  });
  let producer: ChildProcessWithoutNullStreams | null = null;
  let output = "";
  let settled = false;
  let settling = false;
  let consumerSucceeded = false;
  let consumerFailureCategory: PreviewTailFailureCategory | null = null;
  let consumerDiagnosticFragment = "";
  let consumerStderrBytes = 0;
  let consumerExitCode: number | null = null;
  let producerClosedFirst = false;

  consumer.stderr.setEncoding("utf8");
  consumer.stderr.on("data", (chunk: string) => {
    consumerStderrBytes += Buffer.byteLength(chunk, "utf8");
    const candidate = `${consumerDiagnosticFragment}${chunk}`;
    const category = classifyConsumerFailureCategory(candidate);
    if (category !== null) consumerFailureCategory = category;
    consumerDiagnosticFragment = candidate.slice(-96);
  });
  consumer.stdout.setEncoding("utf8");
  // The observer may close stdin immediately after a valid signal. Swallow the
  // resulting pipe error; the observer exit status remains authoritative.
  consumer.stdin.on("error", () => undefined);

  return new Promise((resolvePromise, rejectPromise) => {
    /** Stops every started child, waits for closure, and exposes one error. */
    const rejectClosed = (category: PreviewTailFailureCategory) => {
      if (settled || settling) return;
      settling = true;
      if (producer !== null) producer.stdout.unpipe(consumer.stdin);
      // Read the lifecycle facts when the error is built, not before: the
      // consumer may close while we are still tearing the producer down.
      /** Captures only the safe consumer exit and producer-order facts. */
      const detail = (): PreviewTailFailureDetail => ({
        consumerExitCode,
        producerClosedFirst,
      });
      void Promise.all([
        stopChild(consumer, awaitChildClose),
        ...(producer === null
          ? []
          : [stopChild(producer, awaitChildClose)]),
      ]).then(() => {
        settled = true;
        rejectPromise(new PreviewTailSupervisionError(category, detail()));
      }, () => {
        settled = true;
        rejectPromise(
          new PreviewTailSupervisionError("termination_failure", detail()),
        );
      });
    };

    consumer.stdout.on("data", (chunk: string) => {
      if (
        settled ||
        Buffer.byteLength(output, "utf8") +
          Buffer.byteLength(chunk, "utf8") >
          MAX_CAPTURE_BYTES
      ) {
        rejectClosed("capture_overflow");
        return;
      }
      output += chunk;
    });
    consumer.on("error", () => rejectClosed("consumer_error"));
    consumer.once("spawn", () => {
      if (settled || settling) return;
      producer = spawnCommand(producerCommand);
      producer.stderr.resume();
      producer.stdout.pipe(consumer.stdin);
      producer.on("error", () => rejectClosed("producer_error"));
      producer.on("close", () => {
        if (!consumerSucceeded) {
          // Only a producer close that beats the consumer is an ordering fact;
          // a close during teardown is one we caused.
          if (!settled && !settling) producerClosedFirst = true;
          rejectClosed("producer_closed_before_consumer_success");
        }
      });
    });
    consumer.on("close", (code, signal) => {
      if (settled || settling) return;
      // Record the status only when the consumer closed of its own accord; a
      // close we forced during teardown says nothing about why it failed.
      consumerExitCode = code;
      // Give the stderr stream one event-loop turn to deliver a final fixed
      // diagnostic chunk before selecting the fallback category.
      setImmediate(() => {
        if (settled || settling) return;
        if (code !== 0) {
          rejectClosed(
            consumerFailureCategory ??
              (consumerStderrBytes === 0
                ? "consumer_silent"
                : "consumer_unrecognised"),
          );
          return;
        }
        if (signal !== null) {
          rejectClosed("consumer_signal");
          return;
        }
        consumerSucceeded = true;
        if (producer === null) {
          rejectClosed("producer_unavailable");
          return;
        }
        settling = true;
        producer.stdout.unpipe(consumer.stdin);
        void stopChild(
          producer,
          awaitChildClose,
        ).then(() => {
          if (settled) return;
          settled = true;
          resolvePromise(Object.freeze({
            stdout: output,
            producerTermination: "deliberate" as const,
          }));
        }, () => {
          settled = true;
          rejectPromise(new PreviewTailSupervisionError("termination_failure"));
        });
      });
    });
  });
}

/** Snapshots one bounded argument-array command before any process starts. */
function validateCommand(
  command: PreviewTailChildCommand,
): PreviewTailChildCommand {
  if (
    typeof command?.executable !== "string" ||
    command.executable.length === 0 ||
    /[\0\r\n]/u.test(command.executable) ||
    !Array.isArray(command.arguments) ||
    command.arguments.length > 32 ||
    command.arguments.some(
      (argument) =>
        typeof argument !== "string" ||
        argument.length > 4_096 ||
        /[\0\r\n]/u.test(argument),
    )
  ) {
    throw new Error(FAILURE);
  }
  return Object.freeze({
    executable: command.executable,
    arguments: Object.freeze([...command.arguments]),
  });
}

/** Starts one validated child with captured streams and no shell. */
function spawnCommand(
  command: PreviewTailChildCommand,
  additionalEnvironment: Readonly<Record<string, string>> = {},
): ChildProcessWithoutNullStreams {
  return spawn(command.executable, [...command.arguments], {
    env: { ...process.env, ...additionalEnvironment },
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Admits only the consumer's fixed diagnostic vocabulary. */
function classifyConsumerFailureCategory(
  chunk: string,
): PreviewTailFailureCategory | null {
  const match = /Preview tail observer failed closed: ([a-z_]+)\./u.exec(
    chunk,
  );
  switch (match?.[1]) {
    case "invalid_configuration":
      return "consumer_invalid_configuration";
    case "observer_window_invalid":
      return "consumer_observer_window_invalid";
    case "observer_no_matching_evidence":
      return "consumer_observer_no_matching_evidence";
    case "rejected_terminal_event":
      return "consumer_rejected_terminal_event";
    case "evidence_rejected_by_expectation":
      return "consumer_evidence_rejected_by_expectation";
    case "observer_uniqueness_failed":
      return "consumer_observer_uniqueness_failed";
    case "observer_runtime_error":
      return "consumer_observer_runtime_error";
    case "input_closed_before_evidence":
      return "consumer_input_closed_before_evidence";
    default:
      return null;
  }
}

/** Waits for either a real child close or an unspawnable-child error. */
function waitForChildClose(
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolvePromise) => {
    child.once("close", () => resolvePromise());
    child.once("error", () => resolvePromise());
  });
}

/** Terminates one child and does not resolve until the child is reaped. */
async function stopChild(
  child: ChildProcessWithoutNullStreams,
  awaitChildClose: (
    child: ChildProcessWithoutNullStreams,
  ) => Promise<void>,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (!child.killed) child.kill("SIGTERM");
  await awaitChildClose(child);
}

/** Runs the fixed workflow producer and the allowlisting observer consumer. */
async function main(): Promise<void> {
  try {
    const testExecutable = process.env.PREVIEW_TAIL_TEST_EXECUTABLE;
    const testScript = process.env.PREVIEW_TAIL_TEST_SCRIPT;
    const usingTestRunner =
      process.env.NODE_ENV === "test" &&
      testExecutable !== undefined &&
      testScript !== undefined;
    if (
      (testExecutable === undefined) !== (testScript === undefined) ||
      (usingTestRunner &&
        (!isAbsolute(testExecutable) || !isAbsolute(testScript))) ||
      (!usingTestRunner &&
        (testExecutable !== undefined || testScript !== undefined))
    ) {
      throw new Error(FAILURE);
    }
    const forwardedArguments = process.argv.slice(2);
    const plan = usingTestRunner
      ? Object.freeze({
          producer: {
            executable: testExecutable,
            arguments: [
              testScript,
              "exec",
              "wrangler",
              "tail",
              "vision-preview",
              "--format",
              "json",
            ],
          },
          consumer: {
            executable: testExecutable,
            arguments: [
              testScript,
              "exec",
              "tsx",
              "scripts/print-safe-tail.ts",
              ...forwardedArguments,
            ],
          },
        })
      : createDefaultPreviewTailCommandPlan(forwardedArguments);
    const result = await supervisePreviewTail(plan);
    process.stdout.write(result.stdout);
  } catch (error) {
    if (error instanceof PreviewTailSupervisionError) {
      process.stderr.write(
        `Preview tail supervision failed closed: ${error.category}.\n` +
          `Preview tail supervision detail: consumer_exit=${
            error.consumerExitCode === null ? "none" : error.consumerExitCode
          } producer_closed_first=${error.producerClosedFirst}.\n`,
      );
    }
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
