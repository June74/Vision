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

function unrelatedRun(id: string) {
  return {
    ...run(id),
    head_sha: "b".repeat(40),
  };
}

function fullPageWithMatch(id = "41") {
  return [
    ...Array.from({ length: 99 }, (_, index) =>
      unrelatedRun(String(1_000 + index))),
    run(id),
  ];
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
  it("filters a realistic full workflow job list and finds the named listener among setup steps", async () => {
    const listener = job("Capture restore signal");
    listener.steps = [
      { name: "Checkout", status: "completed", conclusion: "success", completed_at: null },
      { name: "Install", status: "completed", conclusion: "success", completed_at: null },
      ...listener.steps,
    ];
    const uniqueness = job("Capture restore uniqueness");
    uniqueness.steps = [
      { name: "Checkout", status: "completed", conclusion: "success", completed_at: null },
      ...uniqueness.steps,
    ];
    const deps = dependencies([run()], [
      job("Admit one preview operation", "completed", "success"),
      listener,
      uniqueness,
      job("Deploy one generated acceptance candidate", "completed", "skipped"),
    ]);
    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "restore",
    }, deps)).resolves.toBe("41");
  });

  it("reports explicit failed state for terminal non-success signal jobs", async () => {
    const deps = dependencies([run()], [
      job("Capture role_probe signal", "completed", "failure"),
    ]);
    await expect(
      readPreviewSignalObserverState("41" as never, "role_probe", deps),
    ).resolves.toStrictEqual({ signal: "failed", signalObservedAt: null });
  });
  it("admits one observation only on the inclusive terminal poll after the full horizon", async () => {
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
    expect(calls).toBe(25);
    expect(deps.sleep).toHaveBeenCalledTimes(24);
    expect(deps.sleep).toHaveBeenCalledWith(5_000);
    expect(deps.readRun).toHaveBeenCalledOnce();
    expect(deps.listJobs).toHaveBeenCalledOnce();
  });

  it("retains one stable identity through the deadline and rejects a last-poll duplicate", async () => {
    let monotonic = 0;
    let calls = 0;
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns: vi.fn(async () => ({
        workflow_runs:
          ++calls === 25 ? [run("41"), run("42")] : [run("41")],
      })),
      readRun: vi.fn(async (handle) => run(String(handle))),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };
    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(deps.sleep).toHaveBeenCalledTimes(24);
  });

  it("rejects a duplicate on page two after page one has 99 unrelated runs and one match", async () => {
    let monotonic = 0;
    const listRuns = vi.fn(async (page = 1) => ({
      workflow_runs:
        page === 1 ? fullPageWithMatch("41") : [run("42")],
    }));
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async (handle) => run(String(handle))),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(listRuns).toHaveBeenCalledWith(2);
  });

  it("keeps one run stable across every relevant page and poll", async () => {
    let monotonic = 0;
    const listRuns = vi.fn(async (page = 1) => ({
      workflow_runs:
        page === 1
          ? fullPageWithMatch("41")
          : [{ ...unrelatedRun("2001"), created_at: "2026-07-30T17:59:59Z" }],
    }));
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async (handle) => run(String(handle))),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).resolves.toBe("41");
    expect(listRuns).toHaveBeenCalledWith(2);
    expect(listRuns.mock.calls.filter(([page]) => page === 2)).toHaveLength(25);
  });

  it("rejects a duplicate discovered on page two of the terminal poll", async () => {
    let monotonic = 0;
    let poll = 0;
    const listRuns = vi.fn(async (page = 1) => {
      if (page === 1) poll += 1;
      return {
        workflow_runs:
          page === 1
            ? fullPageWithMatch("41")
            : poll === 25
              ? [run("42")]
              : [{ ...unrelatedRun("2001"), created_at: "2026-07-30T17:59:59Z" }],
      };
    });
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async (handle) => run(String(handle))),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(poll).toBe(25);
  });

  it("fails closed when ten full relevant pages cannot prove the listing is complete", async () => {
    let monotonic = 0;
    const listRuns = vi.fn(async (page = 1) => ({
      workflow_runs: Array.from({ length: 100 }, (_, index) =>
        unrelatedRun(String(page * 1_000 + index + 1))),
    }));
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async () => run()),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(listRuns).toHaveBeenCalledWith(10);
    expect(listRuns).toHaveBeenCalledTimes(10);
  });

  it("rejects a malformed exact-shape response on a later page", async () => {
    let monotonic = 0;
    const listRuns = vi.fn(async (page = 1) =>
      page === 1
        ? { workflow_runs: fullPageWithMatch("41") }
        : {
            workflow_runs: [
              { ...unrelatedRun("2001"), created_at: "2026-07-30T17:59:59Z" },
            ],
            unexpected: true,
          });
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async (handle) => run(String(handle))),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(listRuns).toHaveBeenCalledWith(2);
  });

  it.each(["success", "failure", "cancelled", "timed_out"])(
    "rejects an unexpected completed Capture job with %s",
    async (conclusion) => {
      const deps = dependencies([run()], [
        job("Capture foundation_probe signal"),
        job("Capture restore signal", "completed", conclusion),
      ]);
      await expect(resolvePreviewObserverRun({
        expectedWorkflow: ".github/workflows/preview.yml",
        expectedCommit: SHA,
        dispatchStartedAt: START,
        dispatchCompletedAt: END,
        family: "foundation_probe",
      }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    },
  );

  it("allows only an unexpected completed skipped Capture job", async () => {
    const deps = dependencies([run()], [
      job("Capture foundation_probe signal"),
      job("Capture restore signal", "completed", "skipped"),
    ]);
    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).resolves.toBe("41");
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

  it.each([
    ["missing", null],
    ["malformed", "not-a-provider-instant"],
    ["fractional", "2026-07-30T18:00:10.001Z"],
    ["lower precision", "2026-07-30T18:00Z"],
    ["noncanonical date", "2026-02-30T18:00:10Z"],
  ] as const)(
    "rejects a %s provider signal completion timestamp",
    async (_label, completedAt) => {
      const signal = job(
        "Capture role_probe signal",
        "completed",
        "success",
      );
      signal.steps[0]!.completed_at = completedAt;
      const deps = dependencies([run()], [signal]);

      await expect(
        readPreviewSignalObserverState("41" as never, "role_probe", deps),
      ).rejects.toThrow("Preview observer metadata is invalid.");
    },
  );

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

  it.each([
    ["the semantic close", 120_000],
    ["the inclusive settlement deadline", 240_000],
  ] as const)(
    "accepts maintenance completion at %s",
    async (_label, offset) => {
      const maintenance = job(
        "Capture calendar_maintenance uniqueness",
        "completed",
        "success",
      );
      maintenance.steps[0]!.completed_at = new Date(
        TICK.getTime() + offset,
      ).toISOString().replace(".000Z", "Z");
      const deps = dependencies([run()], [maintenance]);
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
    },
  );

  it.each([
    ["one millisecond before the close", 120_000 - 1],
    ["one millisecond after the settlement deadline", 240_000 + 1],
    ["one full second after the settlement deadline", 241_000],
  ] as const)("rejects maintenance completion %s", async (_label, offset) => {
    const maintenance = job(
      "Capture calendar_maintenance uniqueness",
      "completed",
      "success",
    );
    maintenance.steps[0]!.completed_at = new Date(
      TICK.getTime() + offset,
    ).toISOString();
    const deps = dependencies([run()], [maintenance]);
    await expect(
      readPreviewMaintenanceObserverState(
        "41" as never,
        "calendar_maintenance",
        TICK,
        deps,
      ),
    ).rejects.toThrow("Preview observer metadata is invalid.");
  });
});
