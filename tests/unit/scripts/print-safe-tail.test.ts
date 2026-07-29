import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PHASE_B_AI_USAGE_ACTION } from "../../../src/jobs/phase-b-ai-usage-evidence";

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

/** Builds one exact permanent maintenance success result. */
function maintenanceSuccess(): unknown {
  return {
    evidenceType: "vision.calendar-maintenance/v1",
    outcome: "succeeded",
    category: "none",
    repairOutcome: "reserved",
    renewalOutcome: "completed",
  };
}

/** Wraps one permanent maintenance result in the normal maintenance cron. */
function maintenanceTail(evidence: unknown): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron: "*/15 * * * *" },
    logs: [{ message: [{ action: "calendar.maintenance", evidence }] }],
  });
}

/** Builds one exact temporary foundation-probe success result. */
function foundationSuccess(): unknown {
  return {
    evidenceType: "vision.phase-b-foundation-probe/v1",
    outcome: "succeeded",
    category: "none",
    roleMatches: true,
    schemaMatches: true,
    privilegesMatch: true,
    publicGrantCount: 0,
    identityViolations: 0,
    domainViolations: 0,
    privacyViolations: 0,
    provenanceViolations: 0,
    referenceViolations: 0,
    checkpointViolations: 0,
    protectedStorageMatches: true,
    sentinelStatus: "passed",
    backupContractMatches: true,
    databaseBytes: 1,
    r2ObjectCount: 1,
    r2Bytes: 1,
  };
}

/** Wraps one foundation result in the future one-minute candidate shape. */
function foundationTail(evidence: unknown): string {
  return scheduledTail([
    {
      message: [
        { action: "acceptance.phase-b-foundation", evidence },
      ],
    },
  ]);
}

/** Builds one exact AI-usage success result. */
function aiUsageSuccess(): unknown {
  return {
    evidenceType: "vision.ai-usage/v1",
    outcome: "succeeded",
    category: "none",
    monthlyCents: 950,
    warningAtCents: 800,
    optionalStopAtCents: 900,
    hardStopAtCents: 950,
    tier: "stopped",
    gatewayLimitMatches: true,
    nonAiAvailable: true,
  };
}

/** Wraps one AI-usage result in the future one-minute candidate shape. */
function aiUsageTail(evidence: unknown): string {
  return scheduledTail([
    {
      message: [
        { action: PHASE_B_AI_USAGE_ACTION, evidence },
      ],
    },
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

  it("emits only permanent maintenance evidence in calendar-maintenance-only mode", async () => {
    await expect(
      runPrintSafeTail(
        ["--calendar-maintenance-only"],
        [
          scheduledTail(),
          restoreTail(restoreFailure()),
          roleProbeTail(roleProbeSuccess()),
          maintenanceTail(maintenanceSuccess()),
        ],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"none","evidenceType":"vision.calendar-maintenance/v1","outcome":"succeeded","renewalOutcome":"completed","repairOutcome":"reserved"}\n',
    });
  });

  it("emits the fixed fallback when calendar-maintenance-only mode sees no maintenance result", async () => {
    await expect(
      runPrintSafeTail(
        ["--calendar-maintenance-only"],
        [scheduledTail(), restoreTail(restoreFailure())],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    });
  });

  it("emits only foundation evidence in foundation-probe-only mode", async () => {
    const result = await runPrintSafeTail(
      ["--foundation-probe-only"],
      [
        restoreTail(restoreFailure()),
        roleProbeTail(roleProbeSuccess()),
        maintenanceTail(maintenanceSuccess()),
        foundationTail(foundationSuccess()),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(foundationSuccess());
  });

  it("emits the fixed fallback when foundation-probe-only mode sees no foundation result", async () => {
    await expect(
      runPrintSafeTail(
        ["--foundation-probe-only"],
        [restoreTail(restoreFailure()), roleProbeTail(roleProbeSuccess())],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    });
  });

  it("emits only AI evidence in ai-usage-only mode", async () => {
    const evidence = aiUsageSuccess();
    const result = await runPrintSafeTail(
      ["--ai-usage-only"],
      [
        restoreTail(restoreFailure()),
        roleProbeTail(roleProbeSuccess()),
        foundationTail(foundationSuccess()),
        aiUsageTail(evidence),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(evidence);
  });

  it("emits only one exact preview-fault record in preview-fault-only mode", async () => {
    const evidence = {
      evidenceType: "vision.preview-fault/v1",
      scenario: "r2_upload_failed",
      outcome: "failed",
      category: "backup_storage_write_failed",
    };
    const result = await runPrintSafeTail(
      ["--preview-fault-only"],
      [
        scheduledTail(),
        scheduledTail([
          { message: [{ action: "acceptance.preview-fault", evidence }] },
        ]),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(evidence);
  });

  it("emits the fixed fallback when ai-usage-only mode sees no AI result", async () => {
    await expect(
      runPrintSafeTail(
        ["--ai-usage-only"],
        [restoreTail(restoreFailure()), foundationTail(foundationSuccess())],
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

  it("rejects combined maintenance and recovery observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--calendar-maintenance-only", "--restore-only"],
        [maintenanceTail(maintenanceSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });

  it("rejects combined foundation and recovery observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--foundation-probe-only", "--role-probe-only"],
        [foundationTail(foundationSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });

  it("rejects combined AI and foundation observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--ai-usage-only", "--foundation-probe-only"],
        [aiUsageTail(aiUsageSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "" });
  });
});
