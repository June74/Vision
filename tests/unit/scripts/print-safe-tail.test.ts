import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES } from "../../../src/domain/backup/manifest";
import { PHASE_B_AI_USAGE_ACTION } from "../../../src/jobs/phase-b-ai-usage-evidence";
import { createPreviewTailObserver } from "../../../scripts/print-safe-tail";

const PRINT_SAFE_TAIL_PROCESS_TEST_TIMEOUT_MS = 15_000;

/** Runs the safe-tail executable against synthetic, non-sensitive input. */
async function runPrintSafeTail(
  args: readonly string[],
  input: readonly string[],
  closeAfterMilliseconds = 0,
): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve(process.cwd(), "scripts", "print-safe-tail.ts"), ...args],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  if (input.length > 0) child.stdin.write(`${input.join("\n")}\n`);
  if (closeAfterMilliseconds === 0) {
    child.stdin.end();
  } else {
    setTimeout(() => {
      if (!child.stdin.destroyed) child.stdin.end();
    }, closeAfterMilliseconds);
  }
  const [exitCode] = (await once(child, "close")) as [number | null];
  return { exitCode, stdout, stderr };
}

/** Builds the strict argument vector used by a signal observer job. */
function signalArguments(
  mode: string,
  expectation: string,
  extra: readonly string[] = [],
): readonly string[] {
  return [
    mode,
    "--expectation",
    expectation,
    ...extra,
  ];
}

/** Builds a near-future uniqueness contract and its open-stdin duration. */
function uniquenessArguments(
  mode: string,
  expectation: string,
  extra: readonly string[] = [],
): {
  readonly args: readonly string[];
  readonly closeAfterMilliseconds: number;
} {
  const closeAfterMilliseconds = 0;
  return {
    args: [
      mode,
      "--expectation",
      expectation,
      ...extra,
    ],
    closeAfterMilliseconds,
  };
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

/** Builds one exact closed restore success evidence result. */
function restoreSuccess(): unknown {
  return {
    evidenceType: "vision.preview-restore/v1",
    outcome: "succeeded",
    category: "none",
    format: "vision-backup/v1",
    schemaVersion: 9,
    keyVersion: 7,
    authoritativeTableCount: BACKUP_TABLES.length,
    rowCounts: Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])),
    checksumMatches: true,
    referencesValid: true,
    targetWasEmpty: true,
    eventListReadable: true,
    eventCount: 0,
    replacedExisting: false,
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
function maintenanceSuccess(
  maintenanceScheduledAt = "2026-07-30T18:15:00.000Z",
): unknown {
  return {
    evidenceType: "vision.calendar-maintenance/v2",
    maintenanceScheduledAt,
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

/** Wraps one exact suppression result in the scheduled log shape. */
function syncSuppressionTail(): string {
  return scheduledTail([{
    message: [{
      action: "acceptance.sync-suppression",
      evidence: {
        evidenceType: "vision.sync-suppression/v1",
        outcome: "suppressed",
      },
    }],
  }]);
}

describe(
  "print-safe-tail",
  { timeout: PRINT_SAFE_TAIL_PROCESS_TEST_TIMEOUT_MS },
  () => {
  it("holds one AI terminal until exactly expiry plus three minutes", () => {
    const expiresAt = new Date("2026-07-30T18:30:00.000Z");
    const observer = createPreviewTailObserver({
      mode: "ai_usage_uniqueness",
      expectation: { kind: "ai_succeeded" },
      expiresAt,
    });
    const terminal = aiUsageSuccess() as never;
    expect(
      observer.push(terminal, new Date("2026-07-30T18:29:00.000Z")),
    ).toMatchObject({ done: false, succeeded: false });
    expect(observer.finish(new Date("2026-07-30T18:32:59.999Z")))
      .toMatchObject({ done: true, succeeded: false, output: null });
    expect(observer.finish(new Date("2026-07-30T18:33:00.000Z")))
      .toMatchObject({ done: true, succeeded: true, output: terminal });
  });

  it("rejects an AI expiry whose three-minute close overflows", () => {
    expect(() => createPreviewTailObserver({
      mode: "ai_usage_uniqueness",
      expectation: { kind: "ai_succeeded" },
      expiresAt: new Date(8_640_000_000_000_000),
    })).toThrow("invalid");
  });

  it("rejects duplicate AI terminals and keeps the signal mode output-free", () => {
    const expiresAt = new Date("2026-07-30T18:30:00.000Z");
    const uniqueness = createPreviewTailObserver({
      mode: "ai_usage_uniqueness",
      expectation: { kind: "ai_succeeded" },
      expiresAt,
    });
    const signal = createPreviewTailObserver({
      mode: "ai_usage_signal",
      expectation: { kind: "ai_succeeded" },
    });
    const terminal = aiUsageSuccess() as never;
    uniqueness.push(terminal, new Date("2026-07-30T18:29:00.000Z"));
    expect(
      uniqueness.push(terminal, new Date("2026-07-30T18:29:00.001Z")),
    ).toMatchObject({ done: true, succeeded: false, output: null });
    expect(
      signal.push(terminal, new Date("2026-07-30T18:29:00.000Z")),
    ).toMatchObject({ done: true, succeeded: true, output: null });
  });

  it("keeps default mode backward compatible by emitting recovery evidence first", async () => {
    await expect(
      runPrintSafeTail([], [scheduledTail(), restoreTail(restoreFailure())]),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"none","cron":"temporary_recovery","outcome":"ok"}\n',
      stderr: "",
    });
  });

  it("retains one exact restore result until the uniqueness deadline", async () => {
    const observer = createPreviewTailObserver({
      mode: "restore_uniqueness",
      expectation: { kind: "restore_succeeded" },
    });
    const admittedAt = new Date("2026-07-30T18:00:37.000Z");
    expect(observer.push(restoreSuccess() as never, admittedAt)).toMatchObject({
      done: false,
    });
    expect(
      observer.finish(new Date(admittedAt.getTime() + 120_000)),
    ).toMatchObject({
      done: true,
      succeeded: true,
      output: restoreSuccess(),
    });
  });

  it("fails closed without output when restore uniqueness ends with zero terminals", async () => {
    const contract = uniquenessArguments("--restore-only", "restore_succeeded");
    await expect(
      runPrintSafeTail(contract.args, [scheduledTail()]),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("emits only role-probe evidence in role-probe-only mode", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--role-probe-only", "role_probe_succeeded"),
        [
          scheduledTail(),
          roleProbeTail(roleProbeSuccess()),
        ],
      ),
    ).resolves.toEqual({
      exitCode: 0,
      stdout:
        '{"category":"none","evidenceType":"vision.preview-role-probe/v1","outcome":"succeeded","roleMatches":true}\n',
      stderr: "",
    });
  });

  it("fails closed without output when role-probe signal sees no accepting terminal", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--role-probe-only", "role_probe_succeeded"),
        [scheduledTail(), restoreTail(restoreFailure())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("emits only permanent maintenance evidence in calendar-maintenance-only mode", async () => {
    const closesAt = new Date(Date.now() + 3_000);
    const scheduledAt = new Date(closesAt.getTime() - 120_000).toISOString();
    const contract = {
      args: [
        "--calendar-maintenance-only",
        "--expectation",
        "maintenance_repair_reserved",
        "--maintenance-scheduled-at",
        scheduledAt,
      ],
      closeAfterMilliseconds: 3_400,
    };
    const result = await runPrintSafeTail(
      contract.args,
      [
        scheduledTail(),
        maintenanceTail(maintenanceSuccess(scheduledAt)),
      ],
      contract.closeAfterMilliseconds,
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(maintenanceSuccess(scheduledAt));
    expect(result.stderr).toBe("");
  });

  it("fails closed without output when maintenance uniqueness sees no terminal", async () => {
    const contract = uniquenessArguments(
      "--calendar-maintenance-only",
      "maintenance_repair_reserved",
      ["--maintenance-scheduled-at", "2026-07-30T18:15:00.000Z"],
    );
    await expect(
      runPrintSafeTail(
        contract.args,
        [scheduledTail(), restoreTail(restoreFailure())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects the removed maintenance --closes-at argument", async () => {
    const scheduledAt = "2026-07-30T18:15:00.000Z";
    await expect(runPrintSafeTail([
        "--calendar-maintenance-only",
        "--expectation",
        "maintenance_repair_reserved",
        "--closes-at",
        new Date(Date.parse(scheduledAt) + 120_000).toISOString(),
        "--maintenance-scheduled-at",
        scheduledAt,
      ], [maintenanceTail(maintenanceSuccess())])).resolves.toEqual({
        exitCode: 1,
        stdout: "",
        stderr: "",
      });
  });

  it("emits only foundation evidence in foundation-probe-only mode", async () => {
    const result = await runPrintSafeTail(
      signalArguments("--foundation-probe-only", "foundation_succeeded"),
      [
        scheduledTail(),
        maintenanceTail(maintenanceSuccess()),
        foundationTail(foundationSuccess()),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(foundationSuccess());
    expect(result.stderr).toBe("");
  });

  it("fails closed without output when foundation signal sees no result", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--foundation-probe-only", "foundation_succeeded"),
        [restoreTail(restoreFailure()), roleProbeTail(roleProbeSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("accepts one AI signal without emitting evidence", async () => {
    const evidence = aiUsageSuccess();
    const result = await runPrintSafeTail(
      signalArguments("--ai-usage-signal-only", "ai_succeeded"),
      [
        scheduledTail(),
        aiUsageTail(evidence),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("emits only one exact preview-fault record in preview-fault-only mode", async () => {
    const evidence = {
      evidenceType: "vision.preview-fault/v1",
      scenario: "r2_upload_failed",
      outcome: "failed",
      category: "backup_storage_write_failed",
    };
    const result = await runPrintSafeTail(
      signalArguments(
        "--preview-fault-only",
        "fault_expected",
        ["--scenario", "r2_upload_failed"],
      ),
      [
        scheduledTail(),
        scheduledTail([
          { message: [{ action: "acceptance.preview-fault", evidence }] },
        ]),
      ],
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(evidence);
    expect(result.stderr).toBe("");
  });

  it("fails closed without output when AI signal sees no result", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--ai-usage-only", "ai_succeeded"),
        [restoreTail(restoreFailure()), foundationTail(foundationSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
    await expect(
      runPrintSafeTail(
        signalArguments("--ai-usage-signal-only", "ai_succeeded"),
        [restoreTail(restoreFailure()), foundationTail(foundationSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("runs both real suppression workflow flags and keeps signal output-free", async () => {
    const uniqueness = uniquenessArguments(
      "--sync-suppression-only",
      "sync_suppressed",
    );
    await expect(
      runPrintSafeTail(
        signalArguments(
          "--sync-suppression-signal-only",
          "sync_suppressed",
        ),
        [syncSuppressionTail()],
      ),
    ).resolves.toEqual({ exitCode: 0, stdout: "", stderr: "" });
    const unique = await runPrintSafeTail(
      uniqueness.args,
      [syncSuppressionTail()],
      uniqueness.closeAfterMilliseconds,
    );
    expect(unique).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "",
    });
  });

  it("runs the real restore signal flag without output", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--restore-signal-only", "restore_succeeded"),
        [restoreTail(restoreSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("rejects canonical but nonaccepting restore and fault outcomes", async () => {
    await expect(
      runPrintSafeTail(
        signalArguments("--restore-signal-only", "restore_succeeded"),
        [restoreTail(restoreFailure())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
    await expect(
      runPrintSafeTail(
        signalArguments(
          "--preview-fault-only",
          "fault_expected",
          ["--scenario", "queue_delayed"],
        ),
        [scheduledTail([{
          message: [{
            action: "acceptance.preview-fault",
            evidence: {
              evidenceType: "vision.preview-fault/v1",
              scenario: "r2_upload_failed",
              outcome: "failed",
              category: "backup_storage_write_failed",
            },
          }],
        }])],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects duplicate, malformed, and premature restore uniqueness streams", async () => {
    const duplicate = uniquenessArguments("--restore-only", "restore_succeeded");
    await expect(
      runPrintSafeTail(
        duplicate.args,
        [restoreTail(restoreSuccess()), restoreTail(restoreSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });

    const malformed = uniquenessArguments("--restore-only", "restore_succeeded");
    await expect(
      runPrintSafeTail(
        malformed.args,
        [
          restoreTail({ ...restoreSuccess() as object, unexpected: true }),
          restoreTail(restoreSuccess()),
        ],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });

    const premature = uniquenessArguments("--restore-only", "restore_succeeded");
    await expect(
      runPrintSafeTail(premature.args, [restoreTail(restoreSuccess())]),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  }, 15_000);

  it("forbids non-maintenance close instants and requires the maintenance pair", async () => {
    await expect(
      runPrintSafeTail(
        [
          "--sync-suppression-signal-only",
          "--expectation",
          "sync_suppressed",
          "--closes-at",
          new Date(Date.now() + 60_000).toISOString(),
        ],
        [syncSuppressionTail()],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
    await expect(
      runPrintSafeTail(
        [
          "--calendar-maintenance-only",
          "--expectation",
          "maintenance_repair_reserved",
          "--closes-at",
          "2026-07-30T18:17:00.000Z",
        ],
        [maintenanceTail(maintenanceSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects unknown arguments without emitting recovery evidence", async () => {
    await expect(
      runPrintSafeTail(["--unrecognized"], [scheduledTail()]),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects restore-only mode with extra arguments without emitting recovery evidence", async () => {
    await expect(
      runPrintSafeTail(["--restore-only", "extra"], [scheduledTail()]),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects combined observer modes without emitting evidence", async () => {
    await expect(
      runPrintSafeTail(
        ["--restore-only", "--role-probe-only"],
        [roleProbeTail(roleProbeSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects combined maintenance and recovery observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--calendar-maintenance-only", "--restore-only"],
        [maintenanceTail(maintenanceSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects combined foundation and recovery observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--foundation-probe-only", "--role-probe-only"],
        [foundationTail(foundationSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("rejects combined AI and foundation observer modes", async () => {
    await expect(
      runPrintSafeTail(
        ["--ai-usage-only", "--foundation-probe-only"],
        [aiUsageTail(aiUsageSuccess())],
      ),
    ).resolves.toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });
  },
);

describe("bounded preview-tail observer modes", () => {
  const suppression = {
    evidenceType: "vision.sync-suppression/v1" as const,
    outcome: "suppressed" as const,
  };

  it("makes suppression signal-only success immediate and output-free", () => {
    const observer = createPreviewTailObserver({
      mode: "sync_suppression_signal",
      expectation: { kind: "sync_suppressed" },
    });
    expect(
      observer.push(suppression, new Date("2026-07-30T18:00:01.000Z")),
    ).toStrictEqual({ done: true, succeeded: true, output: null });
  });

  it("retains exactly one suppression terminal until the true 120-second close", () => {
    const observer = createPreviewTailObserver({
      mode: "sync_suppression_uniqueness",
      expectation: { kind: "sync_suppressed" },
    });
    expect(
      observer.push(suppression, new Date("2026-07-30T18:00:37.000Z")),
    ).toStrictEqual({ done: false, succeeded: false, output: null });
    expect(
      observer.finish(new Date("2026-07-30T18:02:36.999Z")),
    ).toStrictEqual({ done: true, succeeded: false, output: null });

    const exact = createPreviewTailObserver({
      mode: "sync_suppression_uniqueness",
      expectation: { kind: "sync_suppressed" },
    });
    exact.push(suppression, new Date("2026-07-30T18:00:37.000Z"));
    expect(exact.finish(new Date("2026-07-30T18:02:37.000Z"))).toStrictEqual({
      done: true,
      succeeded: true,
      output: suppression,
    });
  });

  it("rejects duplicate, mixed, nonaccepting, and zero-terminal uniqueness", () => {
    const duplicate = createPreviewTailObserver({
      mode: "sync_suppression_uniqueness",
      expectation: { kind: "sync_suppressed" },
    });
    duplicate.push(suppression, new Date("2026-07-30T18:00:01.000Z"));
    expect(
      duplicate.push(suppression, new Date("2026-07-30T18:00:02.000Z")),
    ).toStrictEqual({ done: true, succeeded: false, output: null });

    const zero = createPreviewTailObserver({
      mode: "restore_uniqueness",
      expectation: { kind: "restore_succeeded" },
    });
    expect(zero.finish(new Date("2026-07-30T18:02:00.000Z"))).toStrictEqual({
      done: true,
      succeeded: false,
      output: null,
    });
  });

  it("binds maintenance uniqueness to one exact canonical scheduled instant", () => {
    const observer = createPreviewTailObserver({
      mode: "maintenance_uniqueness",
      expectation: {
        kind: "maintenance_succeeded",
        maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
      },
    });
    observer.push(
      {
        evidenceType: "vision.calendar-maintenance/v2",
        maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
        outcome: "succeeded",
        category: "none",
        repairOutcome: "no_work",
        renewalOutcome: "completed",
      },
      new Date("2026-07-30T18:15:01.000Z"),
    );
    expect(
      observer.finish(new Date("2026-07-30T18:17:00.000Z")),
    ).toMatchObject({ done: true, succeeded: true });
  });
});
