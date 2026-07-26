import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import playwrightConfig from "../../../playwright.config";
import {
  normalizePlaywrightArguments,
  runManagedE2e,
  type E2eLifecycleDependencies,
} from "../../../scripts/run-e2e";

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
});
