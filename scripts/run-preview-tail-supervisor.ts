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
  | "consumer_nonzero"
  | "consumer_signal"
  | "capture_overflow"
  | "producer_unavailable"
  | "termination_failure";

/** Carries only a fixed failure category; child/provider output never crosses this boundary. */
export class PreviewTailSupervisionError extends Error {
  readonly category: PreviewTailFailureCategory;

  constructor(category: PreviewTailFailureCategory) {
    super(FAILURE);
    this.name = "PreviewTailSupervisionError";
    this.category = category;
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
  const consumer = spawnCommand(consumerCommand);
  let producer: ChildProcessWithoutNullStreams | null = null;
  let output = "";
  let settled = false;
  let settling = false;
  let consumerSucceeded = false;

  consumer.stderr.resume();
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
      void Promise.all([
        stopChild(consumer, awaitChildClose),
        ...(producer === null
          ? []
          : [stopChild(producer, awaitChildClose)]),
      ]).then(() => {
        settled = true;
        rejectPromise(new PreviewTailSupervisionError(category));
      }, () => {
        settled = true;
        rejectPromise(new PreviewTailSupervisionError("termination_failure"));
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
          rejectClosed("producer_closed_before_consumer_success");
        }
      });
    });
    consumer.on("close", (code, signal) => {
      if (settled || settling) return;
      if (code !== 0) {
        rejectClosed("consumer_nonzero");
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
): ChildProcessWithoutNullStreams {
  return spawn(command.executable, [...command.arguments], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
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
        `Preview tail supervision failed closed: ${error.category}.\n`,
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
