import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Runs the safe-tail executable against synthetic, non-sensitive input. */
async function runPrintSafeTail(
  args: readonly string[],
  input: readonly string[],
): Promise<{ readonly exitCode: number | null; readonly stdout: string }> {
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
  return { exitCode, stdout };
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

/** Builds one exact closed role-probe success result. */
function roleProbeSuccess(): unknown {
  return {
    evidenceType: "vision.preview-role-probe/v1",
    outcome: "succeeded",
    category: "none",
    roleMatches: true,
  };
}

/** Wraps one closed role-probe result in the scheduled log shape. */
function roleProbeTail(evidence: unknown): string {
  return scheduledTail([
    { message: [{ action: "backup.restore-role-probe", evidence }] },
  ]);
}

describe("print-safe-tail", () => {
  it("keeps default mode backward compatible by emitting recovery evidence first", async () => {
    await expect(
      runPrintSafeTail([], [scheduledTail(), restoreTail(restoreFailure())]),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"none","cron":"temporary_recovery","outcome":"ok"}\n',
    });
  });

  it("ignores recovery evidence in restore-only mode until an exact restore result arrives", async () => {
    await expect(
      runPrintSafeTail(["--restore-only"], [scheduledTail(), restoreTail(restoreFailure())]),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"evidenceType":"vision.preview-restore/v1","outcome":"failed","category":"restore_unknown_failure"}\n',
    });
  });

  it("emits the closed fallback when restore-only mode ends without restore evidence", async () => {
    await expect(
      runPrintSafeTail(["--restore-only"], [scheduledTail()]),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    });
  });

  it("emits only role-probe evidence in role-probe-only mode", async () => {
    await expect(
      runPrintSafeTail(
        ["--role-probe-only"],
        [
          scheduledTail(),
          restoreTail(restoreFailure()),
          roleProbeTail(roleProbeSuccess()),
        ],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"none","evidenceType":"vision.preview-role-probe/v1","outcome":"succeeded","roleMatches":true}\n',
    });
  });

  it("emits the fixed fallback when role-probe-only mode sees only recovery and restore evidence", async () => {
    await expect(
      runPrintSafeTail(
        ["--role-probe-only"],
        [scheduledTail(), restoreTail(restoreFailure())],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    });
  });

  it("rejects unknown arguments without emitting recovery evidence", async () => {
    await expect(
      runPrintSafeTail(["--unrecognized"], [scheduledTail()]),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });

  it("rejects restore-only mode with extra arguments without emitting recovery evidence", async () => {
    await expect(
      runPrintSafeTail(["--restore-only", "extra"], [scheduledTail()]),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });

  it("rejects combined observer modes without emitting evidence", async () => {
    await expect(
      runPrintSafeTail(
        ["--restore-only", "--role-probe-only"],
        [roleProbeTail(roleProbeSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });
});
