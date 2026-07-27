import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Runs the safe-tail executable against synthetic, non-sensitive input. */
async function runPrintSafeTail(
  args: readonly string[],
  input: readonly string[],
): Promise<string> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve(process.cwd(), "scripts", "print-safe-tail.ts"), ...args],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stdin.end(input.join("\n"));
  const [exitCode] = (await once(child, "close")) as [number | null];
  expect(exitCode).toBe(0);
  return stdout;
}

/** Builds a synthetic scheduled tail event with no provider-controlled fields. */
function scheduledTail(logs: unknown[] = []): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron: "* * * * *" },
    logs,
  });
}

/** Builds one exact closed restore failure evidence result. */
function restoreFailure(): unknown {
  return {
    evidenceType: "vision.preview-restore/v1",
    outcome: "failed",
    category: "restore_unknown_failure",
  };
}

/** Wraps one closed restore result in the scheduled log shape. */
function restoreTail(evidence: unknown): string {
  return scheduledTail([
    { message: [{ action: "backup.restore", evidence }] },
  ]);
}

describe("print-safe-tail", () => {
  it("keeps default mode backward compatible by emitting recovery evidence first", async () => {
    await expect(
      runPrintSafeTail([], [scheduledTail(), restoreTail(restoreFailure())]),
    ).resolves.toBe(
      '{"category":"none","cron":"temporary_recovery","outcome":"ok"}\n',
    );
  });

  it("ignores recovery evidence in restore-only mode until an exact restore result arrives", async () => {
    await expect(
      runPrintSafeTail(["--restore-only"], [scheduledTail(), restoreTail(restoreFailure())]),
    ).resolves.toBe(
      '{"evidenceType":"vision.preview-restore/v1","outcome":"failed","category":"restore_unknown_failure"}\n',
    );
  });

  it("emits the closed fallback when restore-only mode ends without restore evidence", async () => {
    await expect(
      runPrintSafeTail(["--restore-only"], [scheduledTail()]),
    ).resolves.toBe(
      '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    );
  });
});
