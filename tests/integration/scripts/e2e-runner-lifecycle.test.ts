import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import playwrightConfig from "../../../playwright.config";
import {
  normalizePlaywrightArguments,
  runManagedE2e,
  waitForPlaywrightExit,
  type E2eLifecycleDependencies,
  type PlaywrightExitDependencies,
} from "../../../scripts/run-e2e";

const TEST_SETTLEMENT_TIMEOUT_MS = 1_000;

/** Starts an owned Node child that remains alive until the test stops it. */
function spawnHangingChild(): ChildProcess {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    shell: false,
    stdio: "ignore",
  });
}

/** Waits for an exact child exit without leaving a test timer behind. */
async function waitForChildExit(
  child: ChildProcess,
  timeoutMs = TEST_SETTLEMENT_TIMEOUT_MS,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await withTimeout(
    new Promise<void>((resolvePromise) => {
      child.once("exit", () => resolvePromise());
    }),
    timeoutMs,
  );
}

/** Stops a test-owned child even when the assertion path failed. */
async function stopTestChild(child: ChildProcess): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
  }
  await waitForChildExit(child);
}

/** Rejects when a lifecycle promise fails to settle within its contract. */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = TEST_SETTLEMENT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolvePromise, rejectPromise) => {
        timer = setTimeout(
          () => rejectPromise(new Error("lifecycle did not settle")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Creates isolated signal listeners and an injectable owned cleanup boundary. */
function createExitDependencies(
  signalSource: EventEmitter,
  terminate: (child: ChildProcess) => Promise<void>,
): PlaywrightExitDependencies {
  return {
    signalSource,
    terminateOwnedProcess: terminate,
    detachFailedChild: (child) => child.unref(),
    terminationTimeoutMs: 250,
  };
}

/** Proves signal and exact-child listeners were removed after settlement. */
function expectNoLifecycleListeners(
  child: ChildProcess,
  signalSource: EventEmitter,
): void {
  expect(signalSource.listenerCount("SIGINT")).toBe(0);
  expect(signalSource.listenerCount("SIGTERM")).toBe(0);
  expect(child.listenerCount("error")).toBe(0);
  expect(child.listenerCount("exit")).toBe(0);
}

/** Builds a deterministic lifecycle harness that records every owned transition. */
function createHarness(playwrightExitCode = 0): {
  readonly dependencies: E2eLifecycleDependencies;
  readonly transitions: string[];
} {
  const transitions: string[] = [];
  return {
    transitions,
    dependencies: {
      startServer: vi.fn(async () => {
        transitions.push("server:start");
        return {
          close: vi.fn(async () => {
            transitions.push("server:close");
          }),
        };
      }),
      runPlaywright: vi.fn(async (arguments_) => {
        transitions.push(`playwright:${arguments_.join(",")}`);
        return playwrightExitCode;
      }),
      verifyPortReleased: vi.fn(async () => {
        transitions.push("port:released");
      }),
    },
  };
}

describe("managed E2E lifecycle", () => {
  it("removes only the package-manager separator and preserves Playwright selection arguments", () => {
    expect(normalizePlaywrightArguments(["--", "foundation-diagnostics.spec.ts"])).toEqual([
      "foundation-diagnostics.spec.ts",
    ]);
    expect(normalizePlaywrightArguments(["--grep", "keyboard focus"])).toEqual([
      "--grep",
      "keyboard focus",
    ]);
  });

  it("owns startup, Playwright, server close, and port release in deterministic order", async () => {
    const harness = createHarness();

    await expect(
      runManagedE2e(["--", "foundation-diagnostics.spec.ts"], harness.dependencies),
    ).resolves.toBe(0);
    expect(harness.transitions).toEqual([
      "server:start",
      "playwright:foundation-diagnostics.spec.ts",
      "server:close",
      "port:released",
    ]);
  });

  it("propagates a failing Playwright exit after cleanup", async () => {
    const harness = createHarness(7);

    await expect(runManagedE2e([], harness.dependencies)).resolves.toBe(7);
    expect(harness.transitions).toEqual([
      "server:start",
      "playwright:",
      "server:close",
      "port:released",
    ]);
  });

  it("still closes the server and verifies the port when Playwright throws", async () => {
    const harness = createHarness();
    vi.mocked(harness.dependencies.runPlaywright).mockRejectedValueOnce(
      new Error("interrupted"),
    );

    await expect(runManagedE2e([], harness.dependencies)).rejects.toThrow("interrupted");
    expect(harness.transitions).toEqual([
      "server:start",
      "server:close",
      "port:released",
    ]);
  });

  it("still verifies port release when the server close reports a failure", async () => {
    const harness = createHarness();
    vi.mocked(harness.dependencies.startServer).mockResolvedValueOnce({
      close: vi.fn(async () => {
        harness.transitions.push("server:close");
        throw new Error("close failed");
      }),
    });

    await expect(runManagedE2e([], harness.dependencies)).rejects.toThrow(
      "close failed",
    );
    expect(harness.transitions).toEqual([
      "playwright:",
      "server:close",
      "port:released",
    ]);
  });

  it("keeps Playwright configuration free of a shell-owned webServer", () => {
    expect(playwrightConfig).not.toHaveProperty("webServer");
  });

  it("routes the canonical package command through the managed runner", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts?: Record<string, string> };

    expect(packageJson.scripts?.["test:e2e"]).toBe("tsx scripts/run-e2e.ts");
  });

  it("returns 130 after one graceful SIGINT cleanup at the real child boundary", async () => {
    const child = spawnHangingChild();
    const signals = new EventEmitter();
    const terminate = vi.fn(async (ownedChild: ChildProcess) => {
      ownedChild.kill("SIGTERM");
      await waitForChildExit(ownedChild);
    });
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGINT");

      await expect(withTimeout(outcome)).resolves.toBe(130);
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });

  it("returns 143 after one forced SIGTERM cleanup at the real child boundary", async () => {
    const child = spawnHangingChild();
    const signals = new EventEmitter();
    const transitions: string[] = [];
    const terminate = vi.fn(async (ownedChild: ChildProcess) => {
      transitions.push("graceful:timed-out");
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 10));
      transitions.push("forced");
      ownedChild.kill("SIGTERM");
      await waitForChildExit(ownedChild);
    });
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGTERM");

      await expect(withTimeout(outcome)).resolves.toBe(143);
      expect(transitions).toEqual(["graceful:timed-out", "forced"]);
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });

  it("rejects promptly when cleanup fails before a hanging child exits", async () => {
    const child = spawnHangingChild();
    const signals = new EventEmitter();
    const terminate = vi.fn(async () => {
      throw new Error("forced cleanup failed");
    });
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGINT");

      await expect(withTimeout(outcome)).rejects.toThrow("forced cleanup failed");
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });

  it("rejects on the cleanup deadline when termination never settles", async () => {
    const child = spawnHangingChild();
    const signals = new EventEmitter();
    const terminate = vi.fn(
      async () => new Promise<void>(() => undefined),
    );
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGTERM");

      await expect(withTimeout(outcome)).rejects.toThrow(
        "interrupt cleanup deadline",
      );
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });

  it("memoizes one cleanup promise across two different signals", async () => {
    const child = spawnHangingChild();
    const signals = new EventEmitter();
    const terminate = vi.fn(async (ownedChild: ChildProcess) => {
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 10));
      ownedChild.kill("SIGTERM");
      await waitForChildExit(ownedChild);
    });
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGINT");
      signals.emit("SIGTERM");

      await expect(withTimeout(outcome)).resolves.toBe(130);
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });

  it("awaits the shared cleanup when a signaled child exits naturally", async () => {
    const child = spawn(
      process.execPath,
      ["-e", "setTimeout(() => process.exit(0), 20)"],
      { shell: false, stdio: "ignore" },
    );
    const signals = new EventEmitter();
    const terminate = vi.fn(async () => {
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 40));
    });
    try {
      const outcome = waitForPlaywrightExit(
        child,
        createExitDependencies(signals, terminate),
      );
      signals.emit("SIGTERM");

      await expect(withTimeout(outcome)).resolves.toBe(143);
      expect(terminate).toHaveBeenCalledTimes(1);
      expectNoLifecycleListeners(child, signals);
    } finally {
      await stopTestChild(child);
    }
  });
});
