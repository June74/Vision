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

function testCallBoundary() {
  return {
    deadlineMonotonic: performance.now() + 60_000,
    signal: new AbortController().signal,
  };
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
    reconcileCandidateDispatch: vi.fn(async () => null),
    awaitRollbackSettlement: vi.fn(async () => undefined),
    resolveObserver: vi.fn(async () => "41" as never),
    readObserverState: vi
      .fn()
      .mockResolvedValueOnce({
        signal: "listening",
        uniqueness: "listening",
        signalObservedAt: null,
        uniquenessClosesAt: START,
      })
      .mockResolvedValue({
        signal: "succeeded",
        uniqueness: "succeeded",
        signalObservedAt: new Date("2026-07-30T18:00:06.000Z"),
        uniquenessClosesAt: START,
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
  it("creates one AI window before observer dispatch and reuses it exactly", async () => {
    const fixture = harness();

    await runPreviewAcceptanceController(
      {
        family: "ai_usage",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:28:59.999Z",
        expectation: { kind: "ai_succeeded" },
      },
      fixture.dependencies,
    );

    const observe = JSON.parse(fixture.dispatches[0]!.context) as Record<
      string,
      unknown
    >;
    const candidate = JSON.parse(fixture.dispatches[1]!.context) as Record<
      string,
      unknown
    >;
    expect(observe).toMatchObject({
      kind: "observe",
      evidenceFamily: "ai_usage",
      expectedOutcome: "ai_succeeded",
      evidenceScheduledAt: "2026-07-30T18:28:00.000Z",
      expiresAt: "2026-07-30T18:28:59.999Z",
    });
    expect(candidate).toMatchObject({
      kind: "deploy_ai",
      aiZeroActiveGate: "verified",
      evidenceScheduledAt: observe.evidenceScheduledAt,
      expiresAt: observe.expiresAt,
    });
  });

  it("rejects a maximum canonical AI expiry when the derived close is not canonical", async () => {
    const fixture = harness({
      wallNow: () => new Date("9999-12-31T23:30:00.000Z"),
    });

    await expect(runPreviewAcceptanceController({
      family: "ai_usage",
      reviewedCommit: SHA,
      expiresAt: "9999-12-31T23:58:59.999Z",
      expectation: { kind: "ai_succeeded" },
    }, fixture.dependencies)).rejects.toThrow(
      "Preview acceptance controller failed closed.",
    );
    expect(fixture.dependencies.assertRemoteTip).not.toHaveBeenCalled();
    expect(fixture.dispatches).toEqual([]);
  });

  it("keeps AI signal polling open through expiry and uniqueness through expiry plus three minutes", async () => {
    const expiresAt = new Date("2026-07-30T18:28:59.999Z");
    const evidenceScheduledAt = new Date("2026-07-30T18:28:00.000Z");
    const uniquenessClosesAt = new Date(expiresAt.getTime() + 180_000);
    const fixture = harness();
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal:
          fixture.currentWall().getTime() >= evidenceScheduledAt.getTime()
            ? "succeeded" as const
            : "listening" as const,
        uniqueness:
          fixture.currentWall().getTime() >= uniquenessClosesAt.getTime()
            ? "succeeded" as const
            : "listening" as const,
        signalObservedAt:
          fixture.currentWall().getTime() >= evidenceScheduledAt.getTime()
            ? evidenceScheduledAt
            : null,
      }),
    );

    await expect(runPreviewAcceptanceController({
      family: "ai_usage",
      reviewedCommit: SHA,
      expiresAt: expiresAt.toISOString(),
      expectation: { kind: "ai_succeeded" },
    }, fixture.dependencies)).resolves.toBeUndefined();

    expect(fixture.currentWall().getTime()).toBeGreaterThanOrEqual(
      uniquenessClosesAt.getTime(),
    );
    expect(fixture.dispatches.map(({ operation }) => operation)).toEqual([
      "observe",
      "deploy_ai",
      "rollback",
      "close_rollback",
    ]);
  });

  it("dispatches AI rollback at actual expiry when no signal succeeds", async () => {
    const expiresAt = new Date("2026-07-30T18:28:59.999Z");
    const uniquenessClosesAt = new Date(expiresAt.getTime() + 180_000);
    const fixture = harness();
    const originalDispatch = vi
      .mocked(fixture.dependencies.dispatch)
      .getMockImplementation();
    if (originalDispatch === undefined) throw new Error("missing dispatch");
    let rollbackStartedAtMilliseconds: number | null = null;
    vi.mocked(fixture.dependencies.dispatch).mockImplementation(
      async (operation, context, boundary) => {
        if (operation === "rollback") {
          rollbackStartedAtMilliseconds = fixture.currentWall().getTime();
        }
        return originalDispatch(operation, context, boundary);
      },
    );
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "listening" as const,
        uniqueness:
          fixture.currentWall().getTime() >= uniquenessClosesAt.getTime()
            ? "failed" as const
            : "listening" as const,
        signalObservedAt: null,
      }),
    );

    await expect(runPreviewAcceptanceController({
      family: "ai_usage",
      reviewedCommit: SHA,
      expiresAt: expiresAt.toISOString(),
      expectation: { kind: "ai_succeeded" },
    }, fixture.dependencies)).rejects.toThrow(
      "Preview acceptance controller failed closed.",
    );
    expect(rollbackStartedAtMilliseconds).toBe(expiresAt.getTime());
  });

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
        uniquenessClosesAt: START,
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

  it("polls maintenance metadata beyond five seconds after close within the settlement margin", async () => {
    const providerSuccessAt = START.getTime() + 130_000;
    const fixture = harness();
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "listening",
        uniqueness:
          fixture.currentWall().getTime() >= providerSuccessAt
            ? "succeeded"
            : "listening",
        signalObservedAt: null,
      }),
    );

    await expect(runPreviewAcceptanceController({
      family: "calendar_maintenance",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:10:00.000Z",
      expectation: {
        kind: "maintenance_succeeded",
        maintenanceScheduledAt: START.toISOString(),
      },
    }, fixture.dependencies)).resolves.toBeUndefined();
    expect(fixture.currentWall().getTime()).toBeGreaterThanOrEqual(
      providerSuccessAt,
    );
  });

  it.each([
    ["exact settlement deadline", 240_000, true],
    ["one millisecond after settlement", 240_001, false],
  ] as const)(
    "applies the paired maintenance settlement boundary at %s",
    async (_label, offset, accepted) => {
      const fixture = harness();
      vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
        async () => {
          fixture.advanceTime(
            START.getTime() + offset - fixture.currentWall().getTime(),
          );
          return {
            signal: "listening",
            uniqueness: "succeeded",
            signalObservedAt: null,
          };
        },
      );
      const run = runPreviewAcceptanceController({
        family: "calendar_maintenance",
        reviewedCommit: SHA,
        expiresAt: "2026-07-30T18:10:00.000Z",
        expectation: {
          kind: "maintenance_succeeded",
          maintenanceScheduledAt: START.toISOString(),
        },
      }, fixture.dependencies);

      if (accepted) {
        await expect(run).resolves.toBeUndefined();
      } else {
        await expect(run).rejects.toThrow(
          "Preview acceptance controller failed closed.",
        );
        expect(fixture.statuses.at(-1)).toBe("failed_closed");
      }
    },
  );

  it.each([
    ["exact listener boundary", 46 * 60_000, true],
    ["one millisecond beyond the listener", 46 * 60_000 + 1, false],
  ] as const)(
    "admits maintenance only when its semantic close fits the %s",
    async (_label, closeOffset, accepted) => {
      const fixture = harness({
        readObserverState: vi.fn(async () => ({
          signal: "listening" as const,
          uniqueness:
            fixture.currentWall().getTime() >=
            START.getTime() + closeOffset
              ? "succeeded" as const
              : "listening" as const,
          signalObservedAt: null,
        })),
      });
      const run = runPreviewAcceptanceController({
        family: "calendar_maintenance",
        reviewedCommit: SHA,
        expiresAt: new Date(START.getTime() + 2 * 60 * 60_000).toISOString(),
        expectation: {
          kind: "maintenance_succeeded",
          maintenanceScheduledAt: new Date(
            START.getTime() + closeOffset - 120_000,
          ).toISOString(),
        },
      }, fixture.dependencies);

      if (accepted) {
        await expect(run).resolves.toBeUndefined();
        expect(fixture.dispatches.map(({ operation }) => operation)).toEqual([
          "observe",
        ]);
      } else {
        await expect(run).rejects.toThrow(
          "Preview acceptance controller failed closed.",
        );
        expect(fixture.dispatches).toEqual([]);
      }
    },
  );

  it("settles the full 2,710-second restore path inside the listener envelope", async () => {
    let signalObservedAt: Date | null = null;
    let uniquenessClosesAt: Date | null = null;
    const fixture = harness({
      resolveObserver: vi.fn(async () => {
        fixture.advanceTime(125_000);
        return "41" as never;
      }),
      admitRestore: vi.fn(async () => {
        fixture.advanceTime(120_000);
        return "verified" as const;
      }),
      dispatch: vi.fn(async (operation) => {
        if (operation === "observe" || operation === "deploy_restore") {
          fixture.advanceTime(120_000);
        }
        return {
          runRef:
            operation === "observe"
              ? "41"
              : operation === "deploy_restore"
                ? "42"
                : operation === "rollback"
                  ? "43"
                  : "44",
        };
      }),
      verifyCandidateAttribution: vi.fn(async (input) => {
        if (input.operation === "deploy_restore") fixture.advanceTime(120_000);
      }),
      performAction: vi.fn(async () => {
        fixture.advanceTime(31 * 60_000);
        return fixture.currentWall();
      }),
      readObserverState: vi.fn(async () => {
        if (signalObservedAt === null) {
          fixture.advanceTime(120_000);
          signalObservedAt = fixture.currentWall();
          uniquenessClosesAt = new Date(
            signalObservedAt.getTime() + 120_000,
          );
        }
        if (fixture.currentMonotonic() === 2_709_999) {
          fixture.advanceTime(1);
        }
        return {
          signal: "succeeded" as const,
          uniqueness:
            fixture.currentMonotonic() >= 2_710_000
              ? "succeeded" as const
              : "listening" as const,
          signalObservedAt,
          uniquenessClosesAt,
        };
      }),
    });
    vi.mocked(fixture.dependencies.sleep).mockImplementation(
      async (milliseconds) => {
        fixture.advanceTime(
          fixture.currentMonotonic() === 2_705_000 && milliseconds === 5_000
            ? 4_999
            : milliseconds,
        );
      },
    );

    await expect(runPreviewAcceptanceController({
      family: "restore",
      reviewedCommit: SHA,
      expiresAt: new Date(START.getTime() + 2 * 60 * 60_000).toISOString(),
      expectation: { kind: "restore_succeeded" },
      priorCandidateRunRef: "41",
      rollbackClosureRunRef: "42",
    }, fixture.dependencies)).resolves.toBeUndefined();
    expect(fixture.currentMonotonic()).toBe(2_710_000);
    expect(fixture.statuses).toEqual([
      "observer_ready",
      "candidate_dispatched",
      "candidate_signal_seen",
      "rollback_dispatched",
      "closure_verified",
    ]);
    expect(fixture.currentMonotonic()).toBeGreaterThan(42 * 60_000);
    expect(fixture.currentMonotonic()).toBeGreaterThan(44 * 60_000);
    expect(fixture.currentMonotonic()).toBeLessThanOrEqual(46 * 60_000);
  });

  it("does not accept maintenance success one millisecond before local close and accepts it at close", async () => {
    const close = START.getTime() + 120_000;
    const fixture = harness();
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        reads += 1;
        if (reads === 1) {
          fixture.advanceTime(close - 1 - fixture.currentWall().getTime());
        }
        return {
          signal: "listening",
          uniqueness: "succeeded",
          signalObservedAt: null,
        };
      },
    );

    await expect(runPreviewAcceptanceController({
      family: "calendar_maintenance",
      reviewedCommit: SHA,
      expiresAt: "2026-07-30T18:10:00.000Z",
      expectation: {
        kind: "maintenance_succeeded",
        maintenanceScheduledAt: START.toISOString(),
      },
    }, fixture.dependencies)).resolves.toBeUndefined();
    expect(reads).toBe(2);
    expect(fixture.dependencies.sleep).toHaveBeenCalledWith(1);
    expect(fixture.currentWall().getTime()).toBe(close);
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
    for (const [commit, boundary] of vi.mocked(
      fixture.dependencies.assertRemoteTip,
    ).mock.calls) {
      expect(commit).toBe(SHA);
      expect(boundary).toEqual(expect.objectContaining({
        deadlineMonotonic: expect.any(Number),
        signal: expect.anything(),
      }));
    }
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

  it.each([
    ["equal to paired detection wall", 0, true],
    ["one millisecond after paired detection wall", 1, false],
    ["one second after paired detection wall", 1_000, false],
  ] as const)(
    "requires the provider signal timestamp to be no later than detection: %s",
    async (_label, futureMilliseconds, accepted) => {
      const fixture = harness();
      vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
        async () => ({
          signal: "succeeded",
          uniqueness: "succeeded",
          signalObservedAt: new Date(
            fixture.currentWall().getTime() + futureMilliseconds,
          ),
        }),
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
      expect(fixture.dispatches.map(({ operation }) => operation)).toEqual([
        "observe",
        "deploy_foundation",
        "rollback",
        "close_rollback",
      ]);
      expect(fixture.dependencies.verifyClosure).toHaveBeenCalledOnce();
    },
  );

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
    let signalObservedAt: Date | null = null;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        stateReads += 1;
        signalObservedAt ??= fixture.currentWall();
        return {
          signal: "succeeded",
          uniqueness: stateReads < 3 ? "listening" : "succeeded",
          signalObservedAt,
          uniquenessClosesAt: signalObservedAt,
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
        uniquenessClosesAt: fixture.currentWall(),
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

  it("reconciles an uncertain rollback exactly once before failing closed", async () => {
    let rollbackAttempts = 0;
    let rollbackContext: string | null = null;
    const operations: string[] = [];
    const reconcileCandidateDispatch = vi.fn(async () => ({ runRef: "202" }));
    const fixture = harness({
      dispatch: vi.fn(async (operation, context) => {
        operations.push(operation);
        if (operation === "rollback") {
          rollbackAttempts += 1;
          rollbackContext = context;
          throw new Error("protected child failure");
        }
        return { runRef: String(100 + rollbackAttempts) };
      }),
      reconcileCandidateDispatch,
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
    expect(reconcileCandidateDispatch).toHaveBeenCalledOnce();
    expect(reconcileCandidateDispatch).toHaveBeenCalledWith(
      {
        operation: "rollback",
        serializedContext: rollbackContext,
        reviewedCommit: SHA,
      },
      expect.objectContaining({
        deadlineMonotonic: expect.any(Number),
        signal: expect.anything(),
      }),
    );
    expect(fixture.dependencies.verifyCandidateAttribution).toHaveBeenCalledWith(
      {
        runRef: "202",
        operation: "rollback",
        reviewedCommit: SHA,
      },
      expect.objectContaining({
        deadlineMonotonic: expect.any(Number),
        signal: expect.anything(),
      }),
    );
    expect(fixture.dependencies.awaitRollbackSettlement).toHaveBeenCalledOnce();
    expect(operations.slice(-2)).toEqual(["rollback", "close_rollback"]);
    expect(fixture.statuses.slice(-2)).toEqual([
      "closure_verified",
      "failed_closed",
    ]);
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

    await expect(
      dependencies.assertRemoteTip(SHA, testCallBoundary()),
    ).resolves.toBe(true);
    await expect(
      dependencies.dispatch(
        "deploy_foundation",
        '{"safe":true}',
        testCallBoundary(),
      ),
    ).resolves.toEqual({ runRef: "101" });
    const handle = await dependencies.resolveObserver(
      { family: "foundation_probe" },
      testCallBoundary(),
    );
    await expect(
      dependencies.readObserverState(handle, testCallBoundary()),
    ).resolves.toEqual({
      signal: "succeeded",
      uniqueness: "listening",
      signalObservedAt: new Date("2026-07-30T18:00:05.000Z"),
    });
    await dependencies.verifyCandidateAttribution(
      {
        runRef: "101",
        operation: "deploy_foundation",
        reviewedCommit: SHA,
      },
      testCallBoundary(),
    );
    const action = {
      family: "foundation_probe" as const,
      operation: "deploy_foundation" as const,
      candidateRunRef: "101",
      reviewedCommit: SHA,
    };
    await expect(dependencies.requestApproval(
      {
        ...action,
        expiresAt: "2026-07-30T18:10:00.000Z",
      },
      testCallBoundary(),
    )).resolves.toEqual(
      new Date("2026-07-30T18:00:06.000Z"),
    );
    await expect(
      dependencies.performAction(action, testCallBoundary()),
    ).resolves.toEqual(
      new Date("2026-07-30T18:00:07.000Z"),
    );
    await dependencies.awaitRollbackSettlement(
      {
        ...action,
        rollbackRunRef: "102",
      },
      testCallBoundary(),
    );
    await dependencies.verifyClosure(
      {
        ...action,
        rollbackRunRef: "102",
        closureRunRef: "103",
      },
      testCallBoundary(),
    );

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
    expect(calls).toContainEqual({
      executable: "driver-bin",
      arguments_: [
        "--fixed-mode",
        "await-rollback-settlement",
        JSON.stringify({
          reviewedCommit: SHA,
          family: "foundation_probe",
          operation: "deploy_foundation",
          candidateRunRef: "101",
          rollbackRunRef: "102",
        }),
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
    await expect(
      mismatch.assertRemoteTip(SHA, testCallBoundary()),
    ).resolves.toBe(false);
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
      await expect(
        malformed.assertRemoteTip(SHA, testCallBoundary()),
      ).rejects.toThrow(
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
        dependencies.dispatch(
          "deploy_foundation",
          '{"safe":true}',
          testCallBoundary(),
        ),
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

describe("preview acceptance controller decisive hardening", () => {
  it("reconciles an accepted candidate dispatch that throws before returning its receipt", async () => {
    const fixture = harness();
    let candidateDispatchCount = 0;
    const reconcileCandidateDispatch = vi.fn(async () => ({
      runRef: "202",
    }));
    vi.mocked(fixture.dependencies.dispatch).mockImplementation(
      async (operation, context) => {
        fixture.dispatches.push({ operation, context });
        fixture.advanceWall(1000);
        if (operation.startsWith("deploy_")) {
          candidateDispatchCount += 1;
          throw new Error("uncertain candidate dispatch");
        }
        return { runRef: String(200 + fixture.dispatches.length) };
      },
    );
    Object.assign(fixture.dependencies, { reconcileCandidateDispatch });

    let rejection: unknown = null;
    try {
      await runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      );
    } catch (error) {
      rejection = error;
    }

    expect(candidateDispatchCount).toBe(1);
    expect(reconcileCandidateDispatch).toHaveBeenCalledOnce();
    expect(
      fixture.dependencies.verifyCandidateAttribution,
    ).toHaveBeenCalledWith(
      {
        runRef: "202",
        operation: "deploy_foundation",
        reviewedCommit: SHA,
      },
      expect.objectContaining({
        deadlineMonotonic: expect.any(Number),
        signal: expect.anything(),
      }),
    );
    const operations = fixture.dispatches.map(({ operation }) => operation);
    expect(operations).toHaveLength(4);
    expect(operations[0]).toBe("observe");
    expect(operations[1]).toBe("deploy_foundation");
    expect(operations.slice(2)).toEqual(["rollback", "close_rollback"]);
    expect(rejection).toBeNull();
  });

  it.each([
    '{"ok":false}\n',
    '{"ok":"true"}\n',
    '{"ok":true,"extra":false}\n',
  ])("rejects a non-exact rollback-settlement acknowledgement", async (stdout) => {
    const opaqueObserver = Object.freeze(Object.create(null)) as object;
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      observerPort: {
        resolveObserver: async () => opaqueObserver,
        readObserverState: async () => ({
          signal: "listening",
          uniqueness: "listening",
          signalObservedAt: null,
        }),
      },
      runCommand: vi.fn(async () => ({ stdout, stderr: "" })),
    });

    await expect(
      dependencies.awaitRollbackSettlement(
        {
          family: "foundation_probe",
          operation: "deploy_foundation",
          candidateRunRef: "101",
          rollbackRunRef: "102",
          reviewedCommit: SHA,
        },
        testCallBoundary(),
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
  });

  it("propagates a shorter outer abort through the concrete resolver and waits for metadata settlement", async () => {
    let observedDeadline: number | null = null;
    let metadataSettled = false;
    let fallbackUsed = false;
    const outerController = new AbortController();
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      observerDependencies: {
        monotonicNow: () => 0,
        sleep: vi.fn(async () => undefined),
        listRuns: vi.fn(async (_page, context) => {
          observedDeadline = context.deadlineMonotonic;
          await new Promise<void>((_resolveMetadata, rejectMetadata) => {
            const fallback = setTimeout(() => {
              fallbackUsed = true;
              metadataSettled = true;
              rejectMetadata(new Error("metadata fallback"));
            }, 100);
            context.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(fallback);
                metadataSettled = true;
                rejectMetadata(new Error("metadata aborted"));
              },
              { once: true },
            );
          });
          return { workflow_runs: [] };
        }),
        readRun: vi.fn(async () => ({})),
        listJobs: vi.fn(async () => ({ jobs: [] })),
      },
      runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
    });
    const outerBoundary = {
      deadlineMonotonic: 25,
      signal: outerController.signal,
    };
    const resolution = dependencies.resolveObserver(
      {
        family: "foundation_probe",
        expectedCommit: SHA,
        dispatchStartedAt: START,
        dispatchCompletedAt: START,
        expectation: { kind: "foundation_succeeded" },
      },
      outerBoundary,
    );
    setTimeout(() => outerController.abort(), 0);

    await expect(resolution).rejects.toThrow(
      "Preview acceptance controller failed closed.",
    );
    expect(observedDeadline).toBe(25);
    expect(metadataSettled).toBe(true);
    expect(fallbackUsed).toBe(false);
  });

  it("gives the concrete resolver its full window plus terminal metadata settlement", async () => {
    let wall = START.getTime();
    let monotonic = 0;
    let resolutionStartedAt: number | null = null;
    let terminalMetadataDeadline: number | null = null;
    let actionPerformed = false;
    let nextRunRef = 100;
    const advance = (milliseconds: number) => {
      monotonic += milliseconds;
      wall += milliseconds;
    };
    const providerRun = {
      id: "41",
      event: "workflow_dispatch",
      head_sha: SHA,
      created_at: new Date(START.getTime() + 1_000)
        .toISOString()
        .replace(".000Z", "Z"),
      path: ".github/workflows/preview.yml",
      status: "in_progress",
      conclusion: null,
    };
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      gitExecutable: "git-bin",
      wallNow: () => new Date(wall),
      monotonicNow: () => monotonic,
      sleep: async (milliseconds) => advance(milliseconds),
      observerDependencies: {
        monotonicNow: () => monotonic,
        sleep: vi.fn(async (milliseconds: number) => advance(milliseconds)),
        listRuns: vi.fn(async () => ({ workflow_runs: [providerRun] })),
        readRun: vi.fn(async () => providerRun),
        listJobs: vi.fn(async (_handle, context) => {
          resolutionStartedAt ??= monotonic;
          const resolvingFor = monotonic - resolutionStartedAt;
          if (!actionPerformed && resolvingFor >= 120_000) {
            terminalMetadataDeadline = context.deadlineMonotonic;
            advance(1_000);
          }
          const completedAt = actionPerformed
            ? new Date(wall).toISOString().replace(".000Z", "Z")
            : null;
          return {
            jobs: [
              {
                name: "Capture foundation_probe signal",
                status: actionPerformed ? "completed" : "in_progress",
                conclusion: actionPerformed ? "success" : null,
                steps: [
                  {
                    name: "Print only allowlisted acceptance evidence",
                    status: actionPerformed ? "completed" : "in_progress",
                    conclusion: actionPerformed ? "success" : null,
                    completed_at: completedAt,
                  },
                ],
              },
            ],
          };
        }),
      },
      runCommand: vi.fn(async (executable, arguments_) => {
        if (executable === "git-bin") {
          return {
            stdout: `${SHA}\trefs/heads/codex/phase-b-foundation\n`,
            stderr: "",
          };
        }
        const command = arguments_[0] ?? "";
        if (command === "dispatch") {
          if (arguments_[1] === "observe") advance(1_000);
          nextRunRef += 1;
          return {
            stdout: `${JSON.stringify({ runRef: String(nextRunRef) })}\n`,
            stderr: "",
          };
        }
        if (command === "confirm-candidate-deployment") {
          actionPerformed = true;
          return {
            stdout: `${JSON.stringify({ at: new Date(wall).toISOString() })}\n`,
            stderr: "",
          };
        }
        if (
          command === "verify-candidate-attribution" ||
          command === "await-rollback-settlement" ||
          command === "verify-closure"
        ) {
          return { stdout: '{"ok":true}\n', stderr: "" };
        }
        throw new Error("unexpected closed driver command");
      }),
      writeStatus: () => undefined,
    });

    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(resolutionStartedAt).not.toBeNull();
    expect(terminalMetadataDeadline).toBe(
      (resolutionStartedAt as unknown as number) + 125_000,
    );
  });

  it("uses the full candidate workflow window under real advancing clocks", async () => {
    const fixture = harness();
    let candidateConfirmationDeadline: number | null = null;
    const performAction = vi.fn(async (
      _input: Readonly<Record<string, unknown>>,
      boundary: { readonly deadlineMonotonic: number },
    ) => {
      candidateConfirmationDeadline = boundary.deadlineMonotonic;
      if (
        boundary.deadlineMonotonic - fixture.currentMonotonic() <=
        120_000
      ) {
        throw new Error("candidate confirmation was uniqueness-capped");
      }
      fixture.advanceTime(30 * 60_000);
      return fixture.currentWall();
    });
    Object.assign(fixture.dependencies, { performAction });
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "succeeded" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: fixture.currentWall(),
      }),
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 60 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      ),
    ).resolves.toBeUndefined();
    expect(candidateConfirmationDeadline).not.toBeNull();
  });

  it.each([
    ["foundation_probe", { kind: "foundation_succeeded" }],
    ["sync_suppression", { kind: "sync_suppressed" }],
    [
      "calendar_maintenance",
      {
        kind: "maintenance_succeeded",
        maintenanceScheduledAt: START.toISOString(),
      },
    ],
  ] as const)(
    "passes the shorter outer boundary through the concrete %s state reader",
    async (family, expectation) => {
      let monotonic = 0;
      let resolving = true;
      let readDeadline: number | null = null;
      const providerRun = {
        id: "41",
        event: "workflow_dispatch",
        head_sha: SHA,
        created_at: "2026-07-30T18:00:01Z",
        path: ".github/workflows/preview.yml",
        status: "in_progress",
        conclusion: null,
      };
      const jobNames =
        family === "sync_suppression"
          ? [
              "Capture sync_suppression signal",
              "Capture sync_suppression uniqueness",
            ]
          : family === "calendar_maintenance"
            ? ["Capture calendar_maintenance uniqueness"]
            : ["Capture foundation_probe signal"];
      const dependencies = createPreviewControllerSubprocessDependencies({
        driverExecutable: "driver-bin",
        observerDependencies: {
          monotonicNow: () => monotonic,
          sleep: vi.fn(async () => {
            monotonic = 120_000;
          }),
          listRuns: vi.fn(async () => ({ workflow_runs: [providerRun] })),
          readRun: vi.fn(async () => providerRun),
          listJobs: vi.fn(async (_handle, context) => {
            if (!resolving) {
              readDeadline = context.deadlineMonotonic;
              return { jobs: [] };
            }
            return {
              jobs: jobNames.map((name) => ({
                name,
                status: "in_progress",
                conclusion: null,
                steps: [
                  {
                    name: "Print only allowlisted acceptance evidence",
                    status: "in_progress",
                    conclusion: null,
                    completed_at: null,
                  },
                ],
              })),
            };
          }),
        },
        runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
      });
      const controller = new AbortController();
      const handle = await dependencies.resolveObserver(
        {
          family,
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: new Date(START.getTime() + 2_000),
          expectation,
        },
        {
          deadlineMonotonic: 240_000,
          signal: controller.signal,
        },
      );
      resolving = false;

      await expect(
        dependencies.readObserverState(handle, {
          deadlineMonotonic: 120_005,
          signal: controller.signal,
        }),
      ).rejects.toThrow("Preview acceptance controller failed closed.");
      expect(readDeadline).toBe(120_005);
    },
  );

  it("preserves the concrete true close through a late signal and slow rollback closure", async () => {
    let wall = START.getTime();
    let monotonic = 0;
    let actionPerformed = false;
    let signalObservedAt: Date | null = null;
    let postActionJobReads = 0;
    let nextRunRef = 100;
    const driverCommands: string[] = [];
    const statuses: string[] = [];
    const providerRun = {
      id: "41",
      event: "workflow_dispatch",
      head_sha: SHA,
      created_at: "2026-07-30T18:00:01Z",
      path: ".github/workflows/preview.yml",
      status: "in_progress",
      conclusion: null,
    };
    const providerJob = (
      name: string,
      status: "in_progress" | "completed",
      completedAt: Date | null,
    ) => ({
      name,
      status,
      conclusion: status === "completed" ? "success" : null,
      steps: [
        {
          name: "Print only allowlisted acceptance evidence",
          status,
          conclusion: status === "completed" ? "success" : null,
          completed_at:
            completedAt?.toISOString().replace(".000Z", "Z") ?? null,
        },
      ],
    });
    const advance = (milliseconds: number) => {
      monotonic += milliseconds;
      wall += milliseconds;
    };
    const observerDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds: number) => advance(milliseconds)),
      listRuns: vi.fn(async () => ({ workflow_runs: [providerRun] })),
      readRun: vi.fn(async () => providerRun),
      listJobs: vi.fn(async () => {
        if (!actionPerformed) {
          return {
            jobs: [
              providerJob(
                "Capture sync_suppression signal",
                "in_progress",
                null,
              ),
              providerJob(
                "Capture sync_suppression uniqueness",
                "in_progress",
                null,
              ),
            ],
          };
        }
        postActionJobReads += 1;
        if (signalObservedAt === null) {
          advance(119_000);
          signalObservedAt = new Date(wall);
        }
        const uniquenessCompletedAt = new Date(
          signalObservedAt.getTime() + 120_000,
        );
        const uniquenessCompleted = wall >= uniquenessCompletedAt.getTime();
        return {
          jobs: [
            providerJob(
              "Capture sync_suppression signal",
              "completed",
              signalObservedAt,
            ),
            providerJob(
              "Capture sync_suppression uniqueness",
              uniquenessCompleted ? "completed" : "in_progress",
              uniquenessCompleted ? uniquenessCompletedAt : null,
            ),
          ],
        };
      }),
    };
    const runCommand = vi.fn(async (
      executable: string,
      arguments_: readonly string[],
    ) => {
      if (executable === "git-bin") {
        return {
          stdout: `${SHA}\trefs/heads/codex/phase-b-foundation\n`,
          stderr: "",
        };
      }
      const command = arguments_[0] ?? "";
      driverCommands.push(command);
      if (command === "dispatch") {
        if (arguments_[1] === "observe") advance(2_000);
        if (arguments_[1] === "rollback") advance(20_000);
        nextRunRef += 1;
        return {
          stdout: `${JSON.stringify({ runRef: String(nextRunRef) })}\n`,
          stderr: "",
        };
      }
      if (
        command === "verify-candidate-attribution" ||
        command === "verify-closure"
      ) {
        return { stdout: '{"ok":true}\n', stderr: "" };
      }
      if (command === "request-approval") {
        return {
          stdout: `${JSON.stringify({ at: new Date(wall).toISOString() })}\n`,
          stderr: "",
        };
      }
      if (command === "perform-action") {
        actionPerformed = true;
        return {
          stdout: `${JSON.stringify({ at: new Date(wall).toISOString() })}\n`,
          stderr: "",
        };
      }
      if (command === "await-rollback-settlement") {
        advance(110_000);
        return { stdout: '{"ok":true}\n', stderr: "" };
      }
      throw new Error("unexpected closed driver command");
    });
    const concreteDependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: "driver-bin",
      gitExecutable: "git-bin",
      observerDependencies,
      runCommand,
      wallNow: () => new Date(wall),
      monotonicNow: () => monotonic,
      sleep: async (milliseconds) => advance(milliseconds),
      writeStatus: (status) => statuses.push(status),
    });
    const observedStates: Array<{
      readonly signal: string;
      readonly uniqueness: string;
      readonly signalObservedAt: Date | null;
      readonly uniquenessClosesAt?: Date | null;
    }> = [];
    const dependencies = {
      ...concreteDependencies,
      readObserverState: async (
        handle: unknown,
        boundary: ReturnType<typeof testCallBoundary>,
      ) => {
        const state = await concreteDependencies.readObserverState(
          handle,
          boundary,
        );
        observedStates.push(state);
        return state;
      },
    };

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(postActionJobReads).toBeGreaterThanOrEqual(2);
    expect(observedStates[0]).toEqual(expect.objectContaining({
      signal: "succeeded",
      uniqueness: "listening",
      signalObservedAt: expect.any(Date),
      uniquenessClosesAt: expect.any(Date),
    }));
    expect(statuses).toEqual([
      "observer_ready",
      "candidate_dispatched",
      "candidate_signal_seen",
      "rollback_dispatched",
      "closure_verified",
    ]);
    expect(signalObservedAt).not.toBeNull();
    expect(driverCommands.indexOf("await-rollback-settlement")).toBeLessThan(
      driverCommands.lastIndexOf("dispatch"),
    );
  });

  it("uses a fresh reconciliation window and rolls back an accepted candidate dispatch that times out", async () => {
    vi.useFakeTimers();
    try {
      const fixture = harness();
      const originalDispatch = vi
        .mocked(fixture.dependencies.dispatch)
        .getMockImplementation();
      if (originalDispatch === undefined) {
        throw new Error("missing harness dispatch implementation");
      }
      let candidateDispatchCount = 0;
      let candidateDeadline: number | null = null;
      let candidateContext: string | null = null;
      let reconciliationDeadline: number | null = null;
      let reconciliationInput: Readonly<Record<string, unknown>> | null = null;
      let attributionInput: Readonly<Record<string, unknown>> | null = null;
      const reconcileCandidateDispatch = vi.fn(
        async (
          input: Readonly<Record<string, unknown>>,
          boundary: { readonly deadlineMonotonic: number },
        ) => {
          reconciliationInput = input;
          reconciliationDeadline = boundary.deadlineMonotonic;
          return { runRef: "202" };
        },
      );
      vi.mocked(fixture.dependencies.dispatch).mockImplementation(
        async (operation, context, boundary) => {
          if (!operation.startsWith("deploy_")) {
            return originalDispatch(operation, context, boundary);
          }
          candidateDispatchCount += 1;
          candidateContext = context;
          candidateDeadline = boundary.deadlineMonotonic;
          return new Promise<{ readonly runRef: string }>(
            (_resolvePromise, rejectPromise) => {
              boundary.signal.addEventListener(
                "abort",
                () => {
                  fixture.advanceTime(
                    boundary.deadlineMonotonic -
                      fixture.currentMonotonic(),
                  );
                  rejectPromise(new Error("private candidate timeout"));
                },
                { once: true },
              );
            },
          );
        },
      );
      const verifyCandidateAttribution = vi.fn(
        async (input: Readonly<Record<string, unknown>>) => {
          attributionInput = input;
        },
      );
      Object.assign(fixture.dependencies, {
        reconcileCandidateDispatch,
        verifyCandidateAttribution,
      });

      const run = runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      );
      const rejection = expect(run).rejects.toThrow(
        "Preview acceptance controller failed closed.",
      );
      for (
        let pendingTurns = 0;
        candidateDeadline === null && pendingTurns < 32;
        pendingTurns += 1
      ) {
        await Promise.resolve();
      }
      expect(candidateDeadline).not.toBeNull();
      await vi.advanceTimersByTimeAsync(120_000);

      await rejection;
      expect(candidateDispatchCount).toBe(1);
      expect(reconcileCandidateDispatch).toHaveBeenCalledOnce();
      expect(reconciliationDeadline).not.toBeNull();
      expect(reconciliationDeadline as unknown as number).toBeGreaterThan(
        candidateDeadline as unknown as number,
      );
      expect(reconciliationInput).toEqual({
        operation: "deploy_foundation",
        serializedContext: candidateContext,
        reviewedCommit: SHA,
      });
      expect(Object.isFrozen(reconciliationInput)).toBe(true);
      expect(attributionInput).toEqual({
        runRef: "202",
        operation: "deploy_foundation",
        reviewedCommit: SHA,
      });
      expect(Object.isFrozen(attributionInput)).toBe(true);
      expect(fixture.dependencies.performAction).not.toHaveBeenCalled();
      expect(
        fixture.dispatches.map(({ operation }) => operation).slice(-2),
      ).toEqual(["rollback", "close_rollback"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses fresh cleanup time after timely rollback dispatch settles", async () => {
    const fixture = harness();
    const originalDispatch = vi
      .mocked(fixture.dependencies.dispatch)
      .getMockImplementation();
    if (originalDispatch === undefined) {
      throw new Error("missing harness dispatch implementation");
    }
    let rollbackDeadline: number | null = null;
    let settlementDeadline: number | null = null;
    let closureDeadline: number | null = null;
    let verificationDeadline: number | null = null;
    let rollbackSettled = false;
    vi.mocked(fixture.dependencies.dispatch).mockImplementation(
      async (operation, context, boundary) => {
        if (operation === "rollback") {
          rollbackDeadline = boundary.deadlineMonotonic;
          fixture.dispatches.push({ operation, context });
          fixture.advanceTime(
            boundary.deadlineMonotonic - fixture.currentMonotonic(),
          );
          return { runRef: "202" };
        }
        if (operation === "close_rollback") {
          if (!rollbackSettled) {
            throw new Error("closure raced rollback settlement");
          }
          closureDeadline = boundary.deadlineMonotonic;
          fixture.advanceTime(
            boundary.deadlineMonotonic - fixture.currentMonotonic() - 1,
          );
        }
        return originalDispatch(operation, context, boundary);
      },
    );
    const awaitRollbackSettlement = vi.fn(
      async (
        _input: Readonly<Record<string, unknown>>,
        boundary: { readonly deadlineMonotonic: number },
      ) => {
        settlementDeadline = boundary.deadlineMonotonic;
        fixture.advanceTime(
          boundary.deadlineMonotonic - fixture.currentMonotonic() - 1,
        );
        rollbackSettled = true;
      },
    );
    const verifyClosure = vi.fn(
      async (
        _input: Readonly<Record<string, unknown>>,
        boundary: { readonly deadlineMonotonic: number },
      ) => {
        verificationDeadline = boundary.deadlineMonotonic;
      },
    );
    Object.assign(fixture.dependencies, {
      awaitRollbackSettlement,
      verifyClosure,
    });
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => ({
        signal: "succeeded" as const,
        uniqueness: "succeeded" as const,
        signalObservedAt: fixture.currentWall(),
      }),
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(awaitRollbackSettlement).toHaveBeenCalledOnce();
    expect(settlementDeadline).not.toBeNull();
    expect(settlementDeadline as unknown as number).toBeGreaterThan(
      rollbackDeadline as unknown as number,
    );
    expect(closureDeadline as unknown as number).toBeGreaterThan(
      settlementDeadline as unknown as number,
    );
    expect(verificationDeadline as unknown as number).toBeGreaterThan(
      closureDeadline as unknown as number,
    );
  });

  it("settles the no-signal path through rollback before accepting expected uniqueness failure", async () => {
    const fixture = harness();
    let postClosureTerminalReads = 0;
    const providerStates: Array<Readonly<Record<string, unknown>>> = [];
    const awaitRollbackSettlement = vi.fn(async () => {
      expect(
        fixture.dispatches.some(
          ({ operation }) => operation === "close_rollback",
        ),
      ).toBe(false);
      fixture.advanceTime(10_000);
    });
    Object.assign(fixture.dependencies, { awaitRollbackSettlement });
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        const rollbackClosed = fixture.dispatches.some(
          ({ operation }) => operation === "close_rollback",
        );
        if (rollbackClosed) {
          postClosureTerminalReads += 1;
          const state = {
            signal: "listening" as const,
            uniqueness:
              postClosureTerminalReads === 1
                ? "listening" as const
                : "failed" as const,
            signalObservedAt: null,
            ...(postClosureTerminalReads === 1
              ? { uniquenessClosesAt: null }
              : {}),
          };
          providerStates.push(state);
          return state;
        }
        return {
          signal: "listening" as const,
          uniqueness: "listening" as const,
          signalObservedAt: null,
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");

    expect(postClosureTerminalReads).toBe(2);
    expect(providerStates).toHaveLength(2);
    expect(
      providerStates.every((state) =>
        !("uniquenessClosesAt" in state) ||
        state.uniquenessClosesAt === null
      ),
    ).toBe(true);
    expect(awaitRollbackSettlement).toHaveBeenCalledOnce();
    expect(
      fixture.dispatches
        .map(({ operation }) => operation)
        .slice(-2),
    ).toEqual(["rollback", "close_rollback"]);
  });

  it("fails closed when a post-signal uniqueness poll contradicts the signal result", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        reads += 1;
        signalObservedAt ??= fixture.currentWall();
        if (reads === 1) {
          return {
            signal: "succeeded" as const,
            uniqueness: "listening" as const,
            signalObservedAt,
          };
        }
        return {
          signal: "failed" as const,
          uniqueness: "succeeded" as const,
          signalObservedAt,
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
  });

  it("fails closed when a post-signal uniqueness poll drifts the original signal timestamp", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        reads += 1;
        signalObservedAt ??= fixture.currentWall();
        return {
          signal: "succeeded" as const,
          uniqueness:
            reads === 1 ? ("listening" as const) : ("succeeded" as const),
          signalObservedAt:
            reads === 1
              ? signalObservedAt
              : new Date(signalObservedAt.getTime() + 1),
          uniquenessClosesAt: signalObservedAt,
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
  });

  it("waits for the observer's true uniqueness close beyond the old signal estimate", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let uniquenessClosesAt: Date | null = null;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        signalObservedAt ??= fixture.currentWall();
        uniquenessClosesAt ??= new Date(
          signalObservedAt.getTime() + 130_001,
        );
        return {
          signal: "succeeded" as const,
          uniqueness:
            fixture.currentWall().getTime() >= uniquenessClosesAt.getTime()
              ? ("succeeded" as const)
              : ("listening" as const),
          signalObservedAt,
          uniquenessClosesAt,
        } as never;
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts only monotonic provider close advancement and extends the bounded deadline", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let stableClose: Date | null = null;
    let lateClose: Date | null = null;
    const readDeadlines: number[] = [];
    let uniquenessReads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async (_observer, boundary) => {
        readDeadlines.push(boundary.deadlineMonotonic);
        signalObservedAt ??= fixture.currentWall();
        stableClose ??= new Date(signalObservedAt.getTime() + 120_999);
        uniquenessReads += 1;
        if (
          fixture.currentWall().getTime() <
          signalObservedAt.getTime() + 120_001
        ) {
          return {
            signal: "succeeded" as const,
            uniqueness: "listening" as const,
            signalObservedAt,
            uniquenessClosesAt: stableClose,
          };
        }
        lateClose ??= new Date(fixture.currentWall().getTime() + 999);
        return {
          signal: "succeeded" as const,
          uniqueness: "succeeded" as const,
          signalObservedAt,
          uniquenessClosesAt: lateClose,
        };
      },
    );
    const ordinarySleep = fixture.dependencies.sleep;
    Object.assign(fixture.dependencies, {
      sleep: vi.fn(async (milliseconds: number) => {
        await ordinarySleep(milliseconds);
        if (
          signalObservedAt !== null &&
          fixture.currentWall().getTime() ===
            signalObservedAt.getTime() + 120_000
        ) {
          fixture.advanceTime(1);
        }
      }),
    });

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(uniquenessReads).toBeGreaterThan(2);
    expect(Math.max(...readDeadlines)).toBeGreaterThan(readDeadlines[0]!);
  });

  it("rejects backward uniqueness-close drift", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        signalObservedAt ??= fixture.currentWall();
        reads += 1;
        return {
          signal: "succeeded" as const,
          uniqueness: reads === 1 ? ("listening" as const) : ("succeeded" as const),
          signalObservedAt,
          uniquenessClosesAt: new Date(
            signalObservedAt.getTime() + (reads === 1 ? 120_999 : 120_998),
          ),
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
  });

  it("rejects a forward uniqueness close beyond provider timestamp uncertainty", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        signalObservedAt ??= fixture.currentWall();
        reads += 1;
        return {
          signal: "succeeded" as const,
          uniqueness: reads === 1 ? ("listening" as const) : ("succeeded" as const),
          signalObservedAt,
          uniquenessClosesAt: new Date(
            signalObservedAt.getTime() + (reads === 1 ? 120_999 : 130_000),
          ),
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).rejects.toThrow("Preview acceptance controller failed closed.");
  });

  it("accepts unchanged signal success and timestamp through uniqueness settlement", async () => {
    const fixture = harness();
    let signalObservedAt: Date | null = null;
    let reads = 0;
    vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
      async () => {
        reads += 1;
        signalObservedAt ??= fixture.currentWall();
        return {
          signal: "succeeded" as const,
          uniqueness:
            reads === 1 ? ("listening" as const) : ("succeeded" as const),
          signalObservedAt,
          uniquenessClosesAt: signalObservedAt,
        };
      },
    );

    await expect(
      runPreviewAcceptanceController(
        {
          family: "sync_suppression",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "sync_suppressed" },
        },
        fixture.dependencies,
      ),
    ).resolves.toBeUndefined();
  });

  it("interrupts a never-resolving pre-signal controller child at its absolute observer deadline", async () => {
    vi.useFakeTimers();
    try {
      const fixture = harness();
      let aborted = false;
      let deadlineMonotonic: number | null = null;
      const assertRemoteTip = vi.fn(
        async (
          _commit: string,
          boundary?: {
            readonly deadlineMonotonic: number;
            readonly signal: AbortSignal;
          },
        ): Promise<boolean> => {
          if (boundary === undefined) {
            throw new Error("missing controller deadline");
          }
          deadlineMonotonic = boundary.deadlineMonotonic;
          return new Promise<boolean>((_resolvePromise, rejectPromise) => {
            boundary.signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                rejectPromise(new Error("private child timeout"));
              },
              { once: true },
            );
          });
        },
      );
      Object.assign(fixture.dependencies, { assertRemoteTip });

      const run = runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      );
      const rejection = expect(run).rejects.toThrow(
        "Preview acceptance controller failed closed.",
      );
      await vi.advanceTimersByTimeAsync(120_000);

      await rejection;
      expect(deadlineMonotonic).toBe(120_000);
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("interrupts a never-resolving rollback child at the post-signal local deadline", async () => {
    vi.useFakeTimers();
    try {
      const fixture = harness();
      const originalDispatch = vi
        .mocked(fixture.dependencies.dispatch)
        .getMockImplementation();
      if (originalDispatch === undefined) {
        throw new Error("missing harness dispatch implementation");
      }
      let rollbackAborted = false;
      let rollbackDeadline: number | null = null;
      vi.mocked(fixture.dependencies.dispatch).mockImplementation(
        async (
          operation,
          context,
          boundary?: {
            readonly deadlineMonotonic: number;
            readonly signal: AbortSignal;
          },
        ) => {
          if (boundary === undefined) {
            throw new Error("missing rollback deadline");
          }
          if (operation !== "rollback") {
            return originalDispatch(operation, context, boundary);
          }
          rollbackDeadline = boundary.deadlineMonotonic;
          return new Promise<{ readonly runRef: string }>(
            (_resolvePromise, rejectPromise) => {
              boundary.signal.addEventListener(
                "abort",
                () => {
                  rollbackAborted = true;
                  rejectPromise(new Error("private rollback timeout"));
                },
                { once: true },
              );
            },
          );
        },
      );
      vi.mocked(fixture.dependencies.readObserverState).mockImplementation(
        async () => ({
          signal: "succeeded" as const,
          uniqueness: "succeeded" as const,
          signalObservedAt: fixture.currentWall(),
        }),
      );

      const run = runPreviewAcceptanceController(
        {
          family: "foundation_probe",
          reviewedCommit: SHA,
          expiresAt: new Date(START.getTime() + 10 * 60_000).toISOString(),
          expectation: { kind: "foundation_succeeded" },
        },
        fixture.dependencies,
      );
      const rejection = expect(run).rejects.toThrow(
        "Preview acceptance controller failed closed.",
      );
      for (
        let pendingTurns = 0;
        rollbackDeadline === null && pendingTurns < 32;
        pendingTurns += 1
      ) {
        await Promise.resolve();
      }
      expect(rollbackDeadline).not.toBeNull();
      await vi.advanceTimersByTimeAsync(50_001);

      await rejection;
      expect(rollbackDeadline).toBe(
        fixture.currentMonotonic() + 50_001,
      );
      expect(rollbackAborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminates and reaps a timed-out controller child without forwarding either stream", async () => {
    const parentStdout: string[] = [];
    const parentStderr: string[] = [];
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        parentStdout.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        parentStderr.push(String(chunk));
        return true;
      }) as typeof process.stderr.write);
    const opaqueObserver = Object.freeze(Object.create(null)) as object;
    const dependencies = createPreviewControllerSubprocessDependencies({
      driverExecutable: process.execPath,
      driverPrefixArguments: [
        "-e",
        "setTimeout(() => process.stdout.write(JSON.stringify({ runRef: '41' })), 250)",
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
    const dispatchWithBoundary = dependencies.dispatch as unknown as (
      operation: "observe",
      context: string,
      boundary: {
        readonly deadlineMonotonic: number;
        readonly signal: AbortSignal;
      },
    ) => Promise<{ readonly runRef: string }>;
    const startedAt = performance.now();
    try {
      await expect(
        dispatchWithBoundary("observe", "{}", {
          deadlineMonotonic: startedAt + 25,
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow("Preview acceptance controller failed closed.");
      expect(performance.now() - startedAt).toBeLessThan(1_000);
      expect(parentStdout).toEqual([]);
      expect(parentStderr).toEqual([]);
    } finally {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    }
  });
});
