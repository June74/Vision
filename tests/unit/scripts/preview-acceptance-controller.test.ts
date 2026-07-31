import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createPreviewControllerSubprocessDependencies,
  runPreviewAcceptanceController,
  type PreviewAcceptanceControllerDependencies,
} from "../../../scripts/run-preview-acceptance-controller";

const SHA = "a".repeat(40);
const START = new Date("2026-07-30T18:00:00.000Z");

/** Runs the real controller entrypoint with fully captured streams. */
async function runControllerCli(arguments_: readonly string[]): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(process.cwd(), "scripts", "run-preview-acceptance-controller.ts"),
      ...arguments_,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
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
  const [exitCode] = (await once(child, "close")) as [number | null];
  return { exitCode, stdout, stderr };
}

function harness(
  overrides: Partial<PreviewAcceptanceControllerDependencies> = {},
) {
  let wall = START.getTime();
  let monotonic = 0;
  const statuses: string[] = [];
  const dispatches: Array<{
    readonly operation: string;
    readonly context: string;
  }> = [];
  let nextRunRef = 40;
  const dependencies: PreviewAcceptanceControllerDependencies = {
    wallNow: () => new Date(wall),
    monotonicNow: () => monotonic,
    sleep: vi.fn(async (milliseconds) => {
      monotonic += milliseconds;
      wall += milliseconds;
    }),
    assertRemoteTip: vi.fn(async () => true),
    dispatch: vi.fn(async (operation, context) => {
      dispatches.push({ operation, context });
      wall += 1_000;
      nextRunRef += 1;
      return { runRef: String(nextRunRef) };
    }),
    resolveObserver: vi.fn(async () => "41" as never),
    readObserverState: vi
      .fn()
      .mockResolvedValueOnce({
        signal: "listening",
        uniqueness: "listening",
        signalObservedAt: null,
      })
      .mockResolvedValue({
        signal: "succeeded",
        uniqueness: "succeeded",
        signalObservedAt: new Date("2026-07-30T18:00:06.000Z"),
      }),
    verifyCandidateAttribution: vi.fn(async () => undefined),
    admitRestore: vi.fn(async () => "verified" as const),
    requestApproval: vi.fn(async () => {
      wall += 1_000;
      return new Date(wall);
    }),
    performAction: vi.fn(async () => {
      wall += 1_000;
      return new Date(wall);
    }),
    verifyClosure: vi.fn(async () => undefined),
    writeStatus: (status) => statuses.push(status),
    ...overrides,
  };
  return {
    dependencies,
    statuses,
    dispatches,
    advanceWall(milliseconds: number) {
      wall += milliseconds;
    },
    advanceTime(localMilliseconds: number, wallMilliseconds = localMilliseconds) {
      monotonic += localMilliseconds;
      wall += wallMilliseconds;
    },
    currentWall() {
      return new Date(wall);
    },
    currentMonotonic() {
      return monotonic;
    },
  };
}

describe("preview acceptance controller", () => {
  it("deploys and attributes the candidate before requesting approval or acting", async () => {
    const order: string[] = [];
    const fixture = harness({
      dispatch: vi.fn(async (operation) => {
        order.push(operation);
        return { runRef: String(100 + order.length) };
      }),
      resolveObserver: vi.fn(async () => { order.push("observer_attributed"); return "41" as never; }),
      verifyCandidateAttribution: vi.fn(async () => {
        order.push("candidate_attributed");
      }),
      readObserverState: vi.fn(async () => ({
        signal: "succeeded" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: START,
      })),
      requestApproval: vi.fn(async () => { order.push("approval"); return START; }),
      performAction: vi.fn(async () => { order.push("action"); return START; }),
    });
    await runPreviewAcceptanceController(
      {
        family: "sync_suppression",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "sync_suppressed" },
      },
      fixture.dependencies,
    );
    expect(order.indexOf("deploy_sync_suppression")).toBeLessThan(order.indexOf("approval"));
    expect(order.indexOf("observer_attributed")).toBeLessThan(order.indexOf("deploy_sync_suppression"));
    expect(order.indexOf("candidate_attributed")).toBeLessThan(order.indexOf("approval"));
    expect(order.indexOf("approval")).toBeLessThan(order.indexOf("action"));

    const scheduled = harness({
      readObserverState: vi.fn(async () => ({
        signal: "succeeded" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: new Date("2026-07-30T18:00:02.000Z"),
      })),
    });
    vi.mocked(scheduled.dependencies.performAction).mockImplementation(
      async () => scheduled.currentWall(),
    );
    await runPreviewAcceptanceController(
      {
        family: "foundation_probe",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "foundation_succeeded" },
      },
      scheduled.dependencies,
    );
    expect(scheduled.dependencies.requestApproval).not.toHaveBeenCalled();
    expect(scheduled.dependencies.performAction).toHaveBeenCalledOnce();
  });
  it("keeps the observer handle in memory and emits only six fixed statuses", async () => {
    const fixture = harness();
    await runPreviewAcceptanceController(
      {
        family: "sync_suppression",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "sync_suppressed" },
      },
      fixture.dependencies,
    );

    expect(fixture.statuses).toEqual([
      "observer_ready",
      "candidate_dispatched",
      "candidate_signal_seen",
      "rollback_dispatched",
      "closure_verified",
    ]);
    expect(
      fixture.dispatches.every(
        ({ context }) =>
          !/observer.*(?:id|handle)/iu.test(context) &&
          !context.includes('"41"'),
      ),
    ).toBe(true);

    const maintenance = harness({
      readObserverState: vi.fn(async () => ({
        signal: "listening" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: null,
      })),
    });
    await runPreviewAcceptanceController(
      {
        family: "calendar_maintenance",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: {
          kind: "maintenance_succeeded",
          maintenanceScheduledAt: "2026-07-30T18:00:00.000Z",
        },
      },
      maintenance.dependencies,
    );
    expect(maintenance.dispatches.map(({ operation }) => operation)).toEqual([
      "observe",
    ]);
    expect(maintenance.dependencies.requestApproval).not.toHaveBeenCalled();
    expect(maintenance.dependencies.performAction).not.toHaveBeenCalled();
    const maintenanceContext = JSON.parse(
      maintenance.dispatches[0]!.context,
    ) as Record<string, unknown>;
    expect(maintenanceContext).toMatchObject({
      maintenanceScheduledAt: "2026-07-30T18:00:00.000Z",
    });
    expect(maintenanceContext).not.toHaveProperty("observerClosesAt");
  });

  it("compares the remote tip immediately before every dispatch", async () => {
    const fixture = harness();
    await runPreviewAcceptanceController(
      {
        family: "foundation_probe",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "foundation_succeeded" },
      },
      fixture.dependencies,
    );
    expect(fixture.dependencies.assertRemoteTip).toHaveBeenCalledTimes(
      fixture.dispatches.length,
    );
    expect(fixture.dependencies.assertRemoteTip).toHaveBeenCalledWith(SHA);
  });

  it("fails closed on branch movement before candidate dispatch", async () => {
    const fixture = harness({
      assertRemoteTip: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    });
    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:10:00.000Z",
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(fixture.statuses.at(-1)).toBe("failed_closed");
    expect(fixture.dispatches.map(({ operation }) => operation)).toEqual([
      "observe",
    ]);
  });

  it("checks the five-minute and four-minute suppression margins around approval", async () => {
    const beforeApproval = harness();
    beforeApproval.advanceWall(5 * 60_000 + 1);
    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:05:00.000Z",
          expectation: { kind: "sync_suppressed" },
        },
        beforeApproval.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(beforeApproval.dependencies.performAction).not.toHaveBeenCalled();

    const beforeEdit = harness({
      requestApproval: vi.fn(async () => new Date("2026-07-30T18:06:00.001Z")),
    });
    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:10:00.000Z",
          expectation: { kind: "sync_suppressed" },
        },
        beforeEdit.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(beforeEdit.dependencies.performAction).not.toHaveBeenCalled();
  });

  it("rejects approval older than 60 seconds and rolls back without acting", async () => {
    const fixture = harness({
      requestApproval: vi.fn(async () => START),
      wallNow: () => new Date(START.getTime() + 60_001),
    });
    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:10:00.000Z",
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(fixture.dependencies.performAction).not.toHaveBeenCalled();
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it("polls every five seconds and dispatches rollback inside both signal bounds", async () => {
    const fixture = harness();
    await runPreviewAcceptanceController(
      {
        family: "restore",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "restore_succeeded" },
        priorCandidateRunRef: "41",
        rollbackClosureRunRef: "42",
      },
      fixture.dependencies,
    );
    expect(fixture.dependencies.sleep).toHaveBeenCalledWith(5_000);
    expect(fixture.dispatches.map(({ operation }) => operation)).toEqual([
      "observe",
      "deploy_restore",
      "rollback",
      "close_rollback",
    ]);
  });

  it("checks rollback dispatch at exactly 50 local seconds and 59 provider seconds", async () => {
    const fixture = harness();
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "succeeded",
        uniqueness: "succeeded",
        signalObservedAt: fixture.currentWall(),
      }),
    );
    let remoteChecks = 0;
    vi.mocked(fixture.dependencies.assertRemoteTip).mockImplementation(
      async () => {
        remoteChecks += 1;
        if (remoteChecks === 3) fixture.advanceTime(50_000, 59_000);
        return true;
      },
    );

    await runPreviewAcceptanceController(
      {
        family: "foundation_probe",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "foundation_succeeded" },
      },
      fixture.dependencies,
    );
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it.each([
    ["local", 50_001, 50_000],
    ["provider", 1, 59_001],
  ] as const)(
    "rejects rollback dispatch one millisecond beyond the %s bound",
    async (_clock, localDelay, wallDelay) => {
      const fixture = harness();
      vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
        async () => ({
          signal: "succeeded",
          uniqueness: "succeeded",
          signalObservedAt: fixture.currentWall(),
        }),
      );
      let remoteChecks = 0;
      vi.mocked(fixture.dependencies.assertRemoteTip).mockImplementation(
        async () => {
          remoteChecks += 1;
          if (remoteChecks === 3) {
            fixture.advanceTime(localDelay, wallDelay);
          }
          return true;
        },
      );

      await expect(
        runPreviewAcceptanceController(
          {
            family: "foundation_probe",
            reviewedCommit: SHA,
            expiresAt: "2026-07-30T18:10:00.000Z",
            expectation: { kind: "foundation_succeeded" },
          },
          fixture.dependencies,
        ),
      ).rejects.toThrow("Preview acceptance controller failed closed.");
      expect(
        fixture.dispatches.filter(({ operation }) => operation === "rollback"),
      ).toHaveLength(0);
      expect(fixture.statuses.at(-1)).toBe("failed_closed");
    },
  );

  it("rolls back before waiting for delayed uniqueness close", async () => {
    const order: string[] = [];
    const fixture = harness();
    vi.mocked(fixture.dependencies.dispatch).mockImplementation(
      async (operation, context) => {
        order.push(operation);
        return { runRef: String(100 + order.length), context } as never;
      },
    );
    vi.mocked(fixture.dependencies.sleep).mockImplementation(
      async (milliseconds) => {
        order.push(`sleep:${milliseconds}`);
        fixture.advanceTime(milliseconds);
      },
    );
    let stateReads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        stateReads += 1;
        return {
          signal: "succeeded",
          uniqueness: stateReads < 3 ? "listening" : "succeeded",
          signalObservedAt: fixture.currentWall(),
        };
      },
    );

    await runPreviewAcceptanceController(
      {
        family: "restore",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "restore_succeeded" },
        priorCandidateRunRef: "41",
        rollbackClosureRunRef: "42",
      },
      fixture.dependencies,
    );
    expect(order.indexOf("rollback")).toBeLessThan(
      order.lastIndexOf("sleep:5000"),
    );
  });

  it("rolls back without acting at the generic pre-action idle boundary", async () => {
    const fixture = harness();
    await expect(
      runPreviewAcceptanceController(
        {
          family: "ai_usage",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:03:02.000Z",
          expectation: { kind: "ai_succeeded" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(fixture.dependencies.requestApproval).not.toHaveBeenCalled();
    expect(fixture.dependencies.performAction).not.toHaveBeenCalled();
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it("accepts exact five- and four-minute suppression margins around a slow approval", async () => {
    const fixture = harness();
    vi.mocked(fixture.dependencies.requestApproval).mockImplementation(
      async () => {
        fixture.advanceTime(60_000);
        return fixture.currentWall();
      },
    );
    vi.mocked(fixture.dependencies.performAction).mockImplementation(
      async () => fixture.currentWall(),
    );
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "succeeded",
        uniqueness: "succeeded",
        signalObservedAt: fixture.currentWall(),
      }),
    );

    await runPreviewAcceptanceController(
      {
        family: "sync_suppression",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:05:02.000Z",
        expectation: { kind: "sync_suppressed" },
      },
      fixture.dependencies,
    );
    expect(fixture.dependencies.performAction).toHaveBeenCalledTimes(1);
  });

  it("anchors the no-signal timeout to provider-confirmed action completion", async () => {
    const fixture = harness({
      readObserverState: vi.fn(async () => ({
        signal: "listening" as const,
        uniqueness: "listening" as const,
        signalObservedAt: null,
      })),
    });
    const actionMonotonic: number[] = [];
    vi.mocked(fixture.dependencies.performAction).mockImplementation(
      async () => {
        fixture.advanceTime(30_000);
        actionMonotonic.push(fixture.currentMonotonic());
        return fixture.currentWall();
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:10:00.000Z",
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(fixture.currentMonotonic() - actionMonotonic[0]!).toBe(120_000);
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it("subtracts delayed driver return time from the absolute no-signal deadline", async () => {
    const fixture = harness({
      readObserverState: vi.fn(async () => ({
        signal: "listening" as const,
        uniqueness: "listening" as const,
        signalObservedAt: null,
      })),
    });
    let slept = 0;
    vi.mocked(fixture.dependencies.sleep).mockImplementation(async (milliseconds) => {
      slept += milliseconds;
      fixture.advanceTime(milliseconds);
    });
    vi.mocked(fixture.dependencies.performAction).mockImplementation(async () => {
      const completed = fixture.currentWall();
      fixture.advanceTime(30_000);
      return completed;
    });
    await expect(runPreviewAcceptanceController({
      family: "foundation_probe",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:10:00.000Z",
      expectation: { kind: "foundation_succeeded" },
    }, fixture.dependencies)).rejects.toThrow(
      "Preview acceptance controller failed closed.",
    );
    expect(slept).toBe(90_000);
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it.each([
    ["equal to paired wall sample", 0, true],
    ["one millisecond after paired wall sample", 1, false],
  ] as const)(
    "validates driver action completion against the paired wall clock: %s",
    async (_label, futureMilliseconds, accepted) => {
      const fixture = harness();
      vi.mocked(fixture.dependencies.performAction).mockImplementation(
        async () =>
          new Date(fixture.currentWall().getTime() + futureMilliseconds),
      );
      const run = runPreviewAcceptanceController({
        family: "foundation_probe",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "foundation_succeeded" },
      }, fixture.dependencies);

      if (accepted) {
        await expect(run).resolves.toBeUndefined();
      } else {
        await expect(run).rejects.toThrow(
          "Preview acceptance controller failed closed.",
        );
      }
      expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
        "rollback",
      );
      expect(fixture.dependencies.verifyClosure).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["exact boundary", 40_000, true],
    ["one millisecond late", 40_001, false],
  ] as const)("enforces the absolute expiry-derived signal boundary: %s", async (
    _label,
    elapsed,
    accepted,
  ) => {
    let actionCompletedAt = START;
    const fixture = harness();
    vi.mocked(fixture.dependencies.performAction).mockImplementation(async () => {
      actionCompletedAt = fixture.currentWall();
      return actionCompletedAt;
    });
    vi.mocked(fixture.dependencies.readObserverState)
      .mockReset()
      .mockImplementation(
      async () => {
        fixture.advanceTime(
          elapsed === 40_000 ? 39_999 : elapsed,
          elapsed,
        );
        return {
          signal: "succeeded" as const,
          uniqueness: "succeeded" as const,
          signalObservedAt: new Date(actionCompletedAt.getTime() + elapsed),
        };
      },
    );
    const run = runPreviewAcceptanceController({
      family: "foundation_probe",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:01:42.000Z",
      expectation: { kind: "foundation_succeeded" },
    }, fixture.dependencies);
    if (accepted) {
      await expect(run).resolves.toBeUndefined();
    } else {
      await expect(run).rejects.toThrow(
        "Preview acceptance controller failed closed.",
      );
    }
    expect(fixture.dispatches.map(({ operation }) => operation)).toContain(
      "rollback",
    );
  });

  it("rejects caller-asserted restore admission and derives it from a fresh private check", async () => {
    const asserted = harness();
    await expect(runPreviewAcceptanceController({
      family: "restore",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:10:00.000Z",
      expectation: { kind: "restore_succeeded" },
      priorCandidateRunRef: "41",
      rollbackClosureRunRef: "42",
      restoreAdmissionGate: "verified",
    } as never, asserted.dependencies)).rejects.toThrow(
      "Preview acceptance controller failed closed.",
    );
    expect(asserted.dispatches).toEqual([]);

    const order: string[] = [];
    const derived = harness({
      dispatch: vi.fn(async (operation, context) => {
        order.push(operation);
        return { runRef: operation === "observe" ? "41" : "42" };
      }),
      ...({
        admitRestore: vi.fn(async () => {
          order.push("restore_admitted");
          return "verified";
        }),
      } as object),
    } as never);
    await expect(runPreviewAcceptanceController({
      family: "restore",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:10:00.000Z",
      expectation: { kind: "restore_succeeded" },
      priorCandidateRunRef: "41",
      rollbackClosureRunRef: "42",
    }, derived.dependencies)).resolves.toBeUndefined();
    expect(order.indexOf("restore_admitted")).toBe(
      order.indexOf("deploy_restore") - 1,
    );
  });

  it("does not retry an uncertain rollback dispatch", async () => {
    let rollbackAttempts = 0;
    const fixture = harness({
      dispatch: vi.fn(async (operation) => {
        if (operation === "rollback") {
          rollbackAttempts += 1;
          throw new Error("protected child failure");
        }
        return { runRef: String(100 + rollbackAttempts) };
      }),
      readObserverState: vi.fn(async () => ({
        signal: "succeeded" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: START,
      })),
    });
    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: "2026-07-30T18:10:00.000Z",
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
    expect(rollbackAttempts).toBe(1);
  });

  it("uses argument-array subprocesses and keeps child streams captured", async () => {
    const calls: Array<{
      readonly executable: string;
      readonly arguments_: readonly string[];
    }> = [];
    const responses = [
      { stdout: `${SHA}\trefs/heads/codex/phase-b-foundation\n`, stderr: "" },
      { stdout: '{"runRef":"101"}\n', stderr: "discarded provider detail" },
      { stdout: '{"ok":true}\n', stderr: "" },
      { stdout: '{"at":"2026-07-30T18:00:06.000Z"}\n', stderr: "" },
      { stdout: '{"at":"2026-07-30T18:00:07.000Z"}\n', stderr: "" },
      { stdout: '{"ok":true}\n', stderr: "" },
    ];
    const statuses: string[] = [];
    const observerIdentifierCanary = "987654321987654321";
    const opaqueObserver = Object.freeze(Object.create(null)) as object;
    const observerPort = {
      resolveObserver: vi.fn(async () => {
        expect(observerIdentifierCanary).toMatch(/^[1-9][0-9]+$/u);
        return opaqueObserver;
      }),
      readObserverState: vi.fn(async (handle: unknown) => {
        expect(handle).toBe(opaqueObserver);
        return {
          signal: "succeeded" as const,
          uniqueness: "listening" as const,
          signalObservedAt: new Date("2026-07-30T18:00:05.000Z"),
        };
      }),
    };
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      driverPrefixArguments: ["--fixed-mode"],
      gitExecutable: "git-bin",
      observerPort,
      runCommand: vi.fn(async (executable, arguments_) => {
        calls.push({ executable, arguments_: [...arguments_] });
        return responses.shift()!;
      }),
      writeStatus: (status) => statuses.push(status),
    });

    await expect(dependencies.assertRemoteTip(SHA)).resolves.toBe(true);
    await expect(
      dependencies.dispatch("deploy_foundation", '{"safe":true}'),
    ).resolves.toEqual({ runRef: "101" });
    const handle = await dependencies.resolveObserver({ family: "foundation_probe" });
    await expect(dependencies.readObserverState(handle)).resolves.toEqual({
      signal: "succeeded",
      uniqueness: "listening",
      signalObservedAt: new Date("2026-07-30T18:00:05.000Z"),
    });
    await dependencies.verifyCandidateAttribution({
      runRef: "101",
      operation: "deploy_foundation",
      reviewedCommit: SHA,
    });
    const action = {
      family: "foundation_probe" as const,
      operation: "deploy_foundation" as const,
      candidateRunRef: "101",
      reviewedCommit: SHA,
    };
    await expect(dependencies.requestApproval({
      ...action,
      expiresAt: "2026-07-30T18:10:00.000Z",
    })).resolves.toEqual(
      new Date("2026-07-30T18:00:06.000Z"),
    );
    await expect(dependencies.performAction(action)).resolves.toEqual(
      new Date("2026-07-30T18:00:07.000Z"),
    );
    await dependencies.verifyClosure({
      ...action,
      rollbackRunRef: "102",
      closureRunRef: "103",
    });

    expect(calls[0]).toEqual({
      executable: "git-bin",
      arguments_: [
        "ls-remote",
        "--heads",
        "origin",
        "refs/heads/codex/phase-b-foundation",
      ],
    });
    expect(calls[1]).toEqual({
      executable: "driver-bin",
      arguments_: [
        "--fixed-mode",
        "dispatch",
        "deploy_foundation",
        '{"safe":true}',
      ],
    });
    expect(observerPort.resolveObserver).toHaveBeenCalledOnce();
    expect(observerPort.readObserverState).toHaveBeenCalledOnce();
    expect(JSON.stringify(calls)).not.toContain(observerIdentifierCanary);
    expect(statuses).toEqual([]);

    const mismatch = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      observerPort,
      runCommand: vi.fn(async () => ({
        stdout: `${"b".repeat(40)}\trefs/heads/codex/phase-b-foundation\n`,
        stderr: "",
      })),
    });
    await expect(mismatch.assertRemoteTip(SHA)).resolves.toBe(false);
    for (const stdout of [
      "",
      `${SHA}\trefs/heads/other\n`,
      `${SHA}\trefs/heads/codex/phase-b-foundation\n${SHA}\trefs/heads/codex/phase-b-foundation\n`,
      `${SHA.toUpperCase()}\trefs/heads/codex/phase-b-foundation\n`,
    ]) {
      const malformed = createPreviewControllerSubprocessDependencies({
        driverExecutable: "driver-bin",
        observerPort,
        runCommand: vi.fn(async () => ({ stdout, stderr: "" })),
      });
      await expect(malformed.assertRemoteTip(SHA)).rejects.toThrow(
        "Preview acceptance controller failed closed.",
      );
    }
  });

  it("turns URL-bearing child failures into one constant controller error", async () => {
    const parentStdout: string[] = [];
    const parentStderr: string[] = [];
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(
      ((chunk: string | Uint8Array) => {
        parentStdout.push(String(chunk));
        return true;
      }) as typeof process.stdout.write,
    );
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(
      ((chunk: string | Uint8Array) => {
        parentStderr.push(String(chunk));
        return true;
      }) as typeof process.stderr.write,
    );
    const opaqueObserver = Object.freeze(Object.create(null)) as object;
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: process.execPath,
      driverPrefixArguments: [
        "-e",
        "const value='https:'+'//private.invalid/callback?code=fixture';process.stdout.write(value);process.stderr.write(value);process.exit(7)",
        "--",
      ],
      observerPort: {
        resolveObserver: async () => opaqueObserver,
        readObserverState: async () => ({
          signal: "listening",
          uniqueness: "listening",
          signalObservedAt: null,
        }),
      },
    });
    try {
      await expect(
        dependencies.dispatch("deploy_foundation", '{"safe":true}'),
      ).rejects.toThrow("Preview acceptance controller failed closed.");
      expect(parentStdout).toEqual([]);
      expect(parentStderr).toEqual([]);
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    }
  });

  it("has a real fail-closed entrypoint with status-only stdout", async () => {
    const result = await runControllerCli([]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("failed_closed\n");
    expect(result.stderr).toBe("");
  });

  it("never forwards child streams, command arguments, or protected callback values", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const fixture = harness({
      writeStatus: (status) => stdout.push(status),
    });
    await runPreviewAcceptanceController(
      {
        family: "foundation_probe",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: { kind: "foundation_succeeded" },
      },
      fixture.dependencies,
    );
    expect(stdout.every((value) =>
      [
        "observer_ready",
        "candidate_dispatched",
        "candidate_signal_seen",
        "rollback_dispatched",
        "closure_verified",
        "failed_closed",
      ].includes(value),
    )).toBe(true);
    expect(stderr).toEqual([]);
    expect(JSON.stringify(stdout)).not.toContain(SHA);
    expect(JSON.stringify(stdout)).not.toContain("41");
  });
});
