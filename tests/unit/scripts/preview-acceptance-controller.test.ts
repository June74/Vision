import { describe, expect, it, vi } from "vitest";
import {
  runPreviewAcceptanceController,
  type PreviewAcceptanceControllerDependencies,
} from "../../../scripts/run-preview-acceptance-controller";

const SHA = "a".repeat(40);
const START = new Date("2026-07-30T18:00:00.000Z");

function harness(
  overrides: Partial<PreviewAcceptanceControllerDependencies> = {},
) {
  let wall = START.getTime();
  let monotonic = 0;
  const statuses: string[] = [];
  const dispatches: Array<{
    readonly operation: string;
    readonly context: Readonly<Record<string, unknown>>;
  }> = [];
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
  };
}

describe("preview acceptance controller", () => {
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
          !Object.keys(context).some((key) => /observer.*(?:id|handle)/iu.test(key)) &&
          !Object.values(context).includes("41"),
      ),
    ).toBe(true);
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
        restoreAdmissionGate: "verified",
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
