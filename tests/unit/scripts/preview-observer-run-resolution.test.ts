import { describe, expect, it, vi } from "vitest";
import {
  readPreviewMaintenanceObserverState,
  readPreviewSignalObserverState,
  readPreviewTwoJobObserverState,
  resolvePreviewObserverRun,
  type PreviewObserverResolutionDependencies,
} from "../../../scripts/resolve-preview-observer-run";

const SHA = "a".repeat(40);
const START = new Date("2026-07-30T18:00:00.000Z");
const END = new Date("2026-07-30T18:00:02.000Z");
const TICK = new Date("2026-07-30T18:15:00.000Z");

function run(id = "41") {
  return {
    id,
    event: "workflow_dispatch",
    head_sha: SHA,
    created_at: "2026-07-30T18:00:01Z",
    path: ".github/workflows/preview.yml",
    status: "in_progress",
    conclusion: null,
  };
}

function job(name: string, status = "in_progress", conclusion: string | null = null) {
  return {
    name,
    status,
    conclusion,
    steps: [
      {
        name: "Print only allowlisted acceptance evidence",
        status,
        conclusion,
        completed_at:
          status === "completed" ? "2026-07-30T18:00:10Z" : null,
      },
    ],
  };
}

function dependencies(
  runs: readonly unknown[],
  jobs: readonly unknown[],
): PreviewObserverResolutionDependencies {
  let monotonic = 0;
  return {
    monotonicNow: () => monotonic,
    sleep: vi.fn(async (milliseconds: number) => {
      monotonic += milliseconds;
    }),
    listRuns: vi.fn(async () => ({ workflow_runs: runs })),
    readRun: vi.fn(async () => run()),
    listJobs: vi.fn(async () => ({ jobs })),
  };
}

describe("preview observer run resolution", () => {
  it("polls every five seconds through the inclusive 120-second deadline", async () => {
    let calls = 0;
    let monotonic = 0;
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds: number) => {
        monotonic += milliseconds;
      }),
      listRuns: vi.fn(async () => ({
        workflow_runs: ++calls === 25 ? [run()] : [],
      })),
      readRun: vi.fn(async () => run()),
      listJobs: vi.fn(async () => ({
        jobs: [
          job("Capture sync_suppression signal"),
          job("Capture sync_suppression uniqueness"),
        ],
      })),
    };

    const handle = await resolvePreviewObserverRun(
      {
        expectedWorkflow: ".github/workflows/preview.yml",
        expectedCommit: SHA,
        dispatchStartedAt: START,
        dispatchCompletedAt: END,
        family: "sync_suppression",
      },
      deps,
    );

    expect(String(handle)).toBe("41");
    expect(deps.sleep).toHaveBeenCalledTimes(24);
    expect(deps.sleep).toHaveBeenCalledWith(5_000);
  });

  it.each([
    [[]],
    [[run("41"), run("42")]],
    [[{ ...run(), head_sha: "b".repeat(40) }]],
    [[{ ...run(), event: "push" }]],
    [[{ ...run(), created_at: "2026-07-30T17:59:59Z" }]],
    [[{ ...run(), id: "0" }]],
    [[{ ...run(), id: "01" }]],
  ])("fails closed for zero, ambiguous, misattributed, or malformed runs", async (runs) => {
    const deps = dependencies(runs, [
      job("Capture foundation_probe signal"),
    ]);
    await expect(
      resolvePreviewObserverRun(
        {
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: END,
          family: "foundation_probe",
        },
        deps,
      ),
    ).rejects.toThrow("Preview observer metadata is invalid.");
  });

  it("requires the exact two-job, one-job, and maintenance-only listener sets", async () => {
    const twoJob = dependencies([run()], [
      job("Capture sync_suppression signal"),
      job("Capture sync_suppression uniqueness"),
    ]);
    await expect(
      resolvePreviewObserverRun(
        {
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: END,
          family: "sync_suppression",
        },
        twoJob,
      ),
    ).resolves.toBe("41");

    const maintenance = dependencies([run()], [
      job("Capture calendar_maintenance uniqueness"),
    ]);
    await expect(
      resolvePreviewObserverRun(
        {
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: END,
          family: "calendar_maintenance",
          maintenanceScheduledAt: TICK,
        },
        maintenance,
      ),
    ).resolves.toBe("41");

    const extra = dependencies([run()], [
      job("Capture calendar_maintenance uniqueness"),
      job("Capture calendar_maintenance signal"),
    ]);
    await expect(
      resolvePreviewObserverRun(
        {
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: END,
          family: "calendar_maintenance",
          maintenanceScheduledAt: TICK,
        },
        extra,
      ),
    ).rejects.toThrow("Preview observer metadata is invalid.");
  });

  it("uses the listener completion time and successful containing job for signal state", async () => {
    const deps = dependencies([run()], [
      job("Capture role_probe signal", "completed", "success"),
    ]);
    const state = await readPreviewSignalObserverState(
      "41" as never,
      "role_probe",
      deps,
    );
    expect(state).toStrictEqual({
      signal: "succeeded",
      signalObservedAt: new Date("2026-07-30T18:00:10.000Z"),
    });
  });

  it("keeps two-job uniqueness separate from the fast signal", async () => {
    const deps = dependencies([run()], [
      job("Capture restore signal", "completed", "success"),
      job("Capture restore uniqueness"),
    ]);
    await expect(
      readPreviewTwoJobObserverState("41" as never, "restore", deps),
    ).resolves.toStrictEqual({
      signal: "succeeded",
      uniqueness: "listening",
      signalObservedAt: new Date("2026-07-30T18:00:10.000Z"),
    });
  });

  it("accepts maintenance only after the exact tick plus 120-second close", async () => {
    const deps = dependencies([run()], [
      {
        ...job("Capture calendar_maintenance uniqueness", "completed", "success"),
        maintenanceScheduledAt: TICK.toISOString(),
        closedAt: "2026-07-30T18:17:00.000Z",
      },
    ]);
    await expect(
      readPreviewMaintenanceObserverState(
        "41" as never,
        "calendar_maintenance",
        TICK,
        deps,
      ),
    ).resolves.toStrictEqual({
      uniqueness: "succeeded",
      maintenanceScheduledAt: TICK,
    });
  });
});
