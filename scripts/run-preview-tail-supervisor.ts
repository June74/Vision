/** Supervises one raw tail producer behind the privacy-safe observer process. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FAILURE = "Preview tail supervision failed closed.";
const MAX_CAPTURE_BYTES = 65_536;

export interface PreviewTailChildCommand {
  readonly executable: string;
  readonly arguments: readonly string[];
}

export interface PreviewTailSupervisorResult {
  readonly stdout: string;
  readonly producerTermination: "deliberate";
}

/** Runs two argument-array children and owns the producer's successful teardown. */
export function supervisePreviewTail(input: {
  readonly producer: PreviewTailChildCommand;
  readonly consumer: PreviewTailChildCommand;
}): Promise<PreviewTailSupervisorResult> {
  const producer = spawnCommand(input.producer);
  const consumer = spawnCommand(input.consumer);
  let output = "";
  let settled = false;
  let consumerSucceeded = false;

  producer.stdout.pipe(consumer.stdin);
  producer.stderr.resume();
  consumer.stderr.resume();
  consumer.stdout.setEncoding("utf8");
  // The observer may close stdin immediately after a valid signal. Swallow the
  // resulting pipe error; the observer exit status remains authoritative.
  consumer.stdin.on("error", () => undefined);

  return new Promise((resolvePromise, rejectPromise) => {
    /** Stops both children and exposes only the constant failure. */
    const rejectClosed = () => {
      if (settled) return;
      settled = true;
      producer.stdout.unpipe(consumer.stdin);
      if (!producer.killed) producer.kill("SIGTERM");
      if (!consumer.killed) consumer.kill("SIGTERM");
      rejectPromise(new Error(FAILURE));
    };

    consumer.stdout.on("data", (chunk: string) => {
      if (
        settled ||
        Buffer.byteLength(output, "utf8") +
          Buffer.byteLength(chunk, "utf8") >
          MAX_CAPTURE_BYTES
      ) {
        rejectClosed();
        return;
      }
      output += chunk;
    });
    producer.on("error", rejectClosed);
    consumer.on("error", rejectClosed);
    producer.on("close", () => {
      if (!consumerSucceeded) rejectClosed();
    });
    consumer.on("close", (code, signal) => {
      if (settled) return;
      if (code !== 0 || signal !== null) {
        rejectClosed();
        return;
      }
      consumerSucceeded = true;
      producer.stdout.unpipe(consumer.stdin);
      if (!producer.kill("SIGTERM")) {
        rejectClosed();
        return;
      }
      producer.once("close", () => {
        if (settled) return;
        settled = true;
        resolvePromise(Object.freeze({
          stdout: output,
          producerTermination: "deliberate" as const,
        }));
      });
    });
  });
}

/** Starts one bounded child with captured streams and no shell. */
function spawnCommand(
  command: PreviewTailChildCommand,
): ChildProcessWithoutNullStreams {
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
  return spawn(command.executable, [...command.arguments], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Runs the fixed workflow producer and the allowlisting observer consumer. */
async function main(): Promise<void> {
  const packageRunner = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  try {
    const result = await supervisePreviewTail({
      producer: {
        executable: packageRunner,
        arguments: [
          "exec",
          "wrangler",
          "tail",
          "vision-preview",
          "--format",
          "json",
        ],
      },
      consumer: {
        executable: packageRunner,
        arguments: [
          "exec",
          "tsx",
          "scripts/print-safe-tail.ts",
          ...process.argv.slice(2),
        ],
      },
    });
    process.stdout.write(result.stdout);
  } catch {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
