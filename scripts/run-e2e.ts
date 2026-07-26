/** Runs browser tests with one in-process Vite server and deterministic cleanup. */
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, type ViteDevServer } from "vite";

const E2E_HOST = "127.0.0.1";
const E2E_PORT = 5_173;
const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;
const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CHILD_EXIT_GRACE_MS = 3_000;
const INTERRUPT_CLEANUP_DEADLINE_MS = CHILD_EXIT_GRACE_MS * 3 + 1_000;
const PORT_RELEASE_TIMEOUT_MS = 5_000;
const SIGNAL_NUMBERS: Readonly<Record<ManagedSignal, number>> = {
  SIGINT: 2,
  SIGTERM: 15,
};
const require = createRequire(import.meta.url);

type ManagedSignal = "SIGINT" | "SIGTERM";

/** Minimal server lifecycle used by the orchestration contract and tests. */
export interface ManagedE2eServer {
  close(): Promise<void>;
}

/** Injectable boundaries used to prove lifecycle ordering without child processes. */
export interface E2eLifecycleDependencies {
  readonly startServer: () => Promise<ManagedE2eServer>;
  readonly runPlaywright: (arguments_: readonly string[]) => Promise<number>;
  readonly verifyPortReleased: () => Promise<void>;
}

/** Injectable signal and termination boundaries for exact-child lifecycle tests. */
export interface PlaywrightExitDependencies {
  readonly signalSource: {
    once(signal: ManagedSignal, listener: () => void): unknown;
    off(signal: ManagedSignal, listener: () => void): unknown;
  };
  readonly terminateOwnedProcess: (child: ChildProcess) => Promise<void>;
  readonly detachFailedChild: (child: ChildProcess) => void;
  readonly terminationTimeoutMs: number;
}

const productionDependencies: E2eLifecycleDependencies = {
  startServer: startViteServer,
  runPlaywright: runPlaywrightCli,
  verifyPortReleased,
};
const productionExitDependencies: PlaywrightExitDependencies = {
  signalSource: process,
  terminateOwnedProcess,
  /** Lets the runner exit nonzero if the operating system refuses termination. */
  detachFailedChild: (child) => child.unref(),
  terminationTimeoutMs: INTERRUPT_CLEANUP_DEADLINE_MS,
};

/** Removes pnpm's explicit separator while preserving every Playwright argument. */
export function normalizePlaywrightArguments(
  arguments_: readonly string[],
): readonly string[] {
  return arguments_[0] === "--" ? arguments_.slice(1) : [...arguments_];
}

/** Owns server start, test execution, server close, and port verification. */
export async function runManagedE2e(
  arguments_: readonly string[],
  dependencies: E2eLifecycleDependencies = productionDependencies,
): Promise<number> {
  let server: ManagedE2eServer | undefined;
  try {
    server = await dependencies.startServer();
    return await dependencies.runPlaywright(
      normalizePlaywrightArguments(arguments_),
    );
  } finally {
    try {
      await server?.close();
    } finally {
      await dependencies.verifyPortReleased();
    }
  }
}

/** Starts Vite in-process without Cloudflare or a shell-owned server child. */
async function startViteServer(): Promise<ManagedE2eServer> {
  const server = await createServer({
    configFile: resolve(PROJECT_ROOT, "vite.config.ts"),
    logLevel: process.env.CI ? "error" : "info",
    mode: "test",
    server: {
      host: E2E_HOST,
      port: E2E_PORT,
      strictPort: true,
    },
  });
  try {
    await server.listen();
    return {
      /** Closes Vite watchers and sockets within the runner process. */
      close: async () => {
        await server.close();
      },
    };
  } catch (error) {
    await closeFailedViteServer(server);
    throw error;
  }
}

/** Closes a partially started Vite instance without hiding its startup error. */
async function closeFailedViteServer(server: ViteDevServer): Promise<void> {
  await server.close().catch(() => undefined);
}

/** Launches Playwright without a shell and propagates its exact normal exit code. */
async function runPlaywrightCli(
  arguments_: readonly string[],
): Promise<number> {
  const cliPath = require.resolve("@playwright/test/cli");
  const child = spawn(
    process.execPath,
    [cliPath, "test", ...arguments_],
    {
      cwd: PROJECT_ROOT,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_BASE_URL: E2E_BASE_URL,
      },
      shell: false,
      stdio: "inherit",
    },
  );
  return waitForPlaywrightExit(child);
}

/** Converts child exit, launch failure, or parent interruption into one result. */
export async function waitForPlaywrightExit(
  child: ChildProcess,
  dependencies: PlaywrightExitDependencies = productionExitDependencies,
): Promise<number> {
  let requestedSignal: ManagedSignal | undefined;
  let terminationPromise: Promise<void> | undefined;
  let resolveTerminationOutcome!: (
    value:
      | { readonly kind: "termination-succeeded" }
      | PromiseLike<{ readonly kind: "termination-succeeded" }>,
  ) => void;
  const terminationOutcomePromise = new Promise<{
    readonly kind: "termination-succeeded";
  }>((resolvePromise) => {
    resolveTerminationOutcome = resolvePromise;
  });
  /** Records the first signal and exposes its one bounded cleanup promise. */
  const requestStop = (signal: ManagedSignal): void => {
    if (terminationPromise) return;
    requestedSignal = signal;
    terminationPromise = withDeadline(
      dependencies.terminateOwnedProcess(child),
      dependencies.terminationTimeoutMs,
      "Playwright interrupt cleanup deadline exceeded.",
    );
    resolveTerminationOutcome(
      terminationPromise.then(() => ({ kind: "termination-succeeded" })),
    );
  };
  /** Converts Ctrl+C into an owned-child stop request. */
  const interrupt = (): void => requestStop("SIGINT");
  /** Converts an external termination into an owned-child stop request. */
  const terminate = (): void => requestStop("SIGTERM");
  /** Resolves child launch errors as data so signal cleanup remains awaited. */
  const onChildError = (error: Error): void => {
    resolveChildOutcome({ kind: "child-error", error });
  };
  /** Resolves the exact child exit code or terminating signal. */
  const onChildExit = (
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void => {
    resolveChildOutcome({ kind: "child-exit", code, signal });
  };
  let resolveChildOutcome!: (
    outcome:
      | {
          readonly kind: "child-error";
          readonly error: Error;
        }
      | {
          readonly kind: "child-exit";
          readonly code: number | null;
          readonly signal: NodeJS.Signals | null;
        },
  ) => void;
  const childOutcomePromise = new Promise<
    | {
        readonly kind: "child-error";
        readonly error: Error;
      }
    | {
        readonly kind: "child-exit";
        readonly code: number | null;
        readonly signal: NodeJS.Signals | null;
      }
  >((resolvePromise) => {
    resolveChildOutcome = resolvePromise;
  });
  child.once("error", onChildError);
  child.once("exit", onChildExit);
  dependencies.signalSource.once("SIGINT", interrupt);
  dependencies.signalSource.once("SIGTERM", terminate);
  try {
    let outcome:
      | Awaited<typeof childOutcomePromise>
      | Awaited<typeof terminationOutcomePromise>;
    try {
      outcome = await Promise.race([
        childOutcomePromise,
        terminationOutcomePromise,
      ]);
    } catch (error) {
      dependencies.detachFailedChild(child);
      throw error;
    }
    if (requestedSignal && terminationPromise) {
      try {
        await terminationPromise;
      } catch (error) {
        dependencies.detachFailedChild(child);
        throw error;
      }
      return signalExitCode(requestedSignal);
    }
    if (outcome.kind === "termination-succeeded") return 1;
    if (outcome.kind === "child-error") throw outcome.error;
    if (outcome.code !== null) return outcome.code;
    return 1;
  } finally {
    dependencies.signalSource.off("SIGINT", interrupt);
    dependencies.signalSource.off("SIGTERM", terminate);
    child.off("error", onChildError);
    child.off("exit", onChildExit);
  }
}

/** Adds one absolute deadline while consuming any later source rejection. */
async function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolvePromise, rejectPromise) => {
        timer = setTimeout(() => rejectPromise(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Requests graceful child exit, then force-kills only its owned tree if needed. */
async function terminateOwnedProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForOwnedExit(child, CHILD_EXIT_GRACE_MS)) return;
  await forceKillOwnedProcess(child);
  if (!(await waitForOwnedExit(child, CHILD_EXIT_GRACE_MS))) {
    throw new Error("The owned Playwright process did not exit after cleanup.");
  }
}

/** Waits a bounded interval for the exact owned child to exit. */
async function waitForOwnedExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolvePromise) => {
    /** Resolves the bounded wait when the exact child exit event arrives. */
    const onExit = (): void => {
      clearTimeout(timer);
      resolvePromise(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolvePromise(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

/** Force-kills only the Playwright PID tree on Windows or owned group on POSIX. */
async function forceKillOwnedProcess(child: ChildProcess): Promise<void> {
  if (!child.pid) throw new Error("The owned Playwright process has no PID.");
  if (process.platform !== "win32") {
    process.kill(-child.pid, "SIGKILL");
    return;
  }
  const taskkill = spawn(
    "taskkill",
    ["/pid", String(child.pid), "/T", "/F"],
    { shell: false, stdio: "ignore", windowsHide: true },
  );
  if (!(await waitForOwnedExit(taskkill, CHILD_EXIT_GRACE_MS))) {
    taskkill.kill("SIGKILL");
    throw new Error("Timed out while cleaning the owned Playwright process tree.");
  }
  if (taskkill.exitCode !== 0 && child.exitCode === null) {
    throw new Error("Could not clean the owned Playwright process tree.");
  }
}

/** Polls until the runner's fixed Vite port no longer accepts connections. */
async function verifyPortReleased(): Promise<void> {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!(await isPortListening())) return;
    await delay(50);
  }
  throw new Error(`E2E server port ${E2E_PORT} remained open after cleanup.`);
}

/** Checks the exact local E2E host and port without scanning unrelated processes. */
async function isPortListening(): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: E2E_HOST, port: E2E_PORT });
    /** Closes the probe exactly once and reports whether it connected. */
    const finish = (listening: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(listening);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

/** Resolves after a short polling interval without blocking process signals. */
async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/** Converts a handled POSIX-style signal to the conventional shell exit code. */
function signalExitCode(signal: ManagedSignal): number {
  return 128 + SIGNAL_NUMBERS[signal];
}

/** Runs the production lifecycle and reports setup failures without swallowing exit codes. */
async function main(): Promise<void> {
  try {
    process.exitCode = await runManagedE2e(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown E2E lifecycle failure.";
    console.error(`E2E lifecycle failed: ${message}`);
    process.exitCode = 1;
  }
}

/** Detects direct execution while keeping the lifecycle importable for tests. */
function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return !!entryPath &&
    pathToFileURL(resolve(entryPath)).href === import.meta.url;
}

if (isMainModule()) {
  await main();
}
