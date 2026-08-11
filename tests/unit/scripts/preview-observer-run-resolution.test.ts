import { spawn } from "node:child_process";

describe("outer preview observer call boundaries", () => {
  it("caps resolver polling at a shorter outer deadline", async () => {
    const candidate = run();
    let monotonic = 0;
    const observedSleeps: Array<{
      readonly milliseconds: number;
      readonly deadlineMonotonic: number;
    }> = [];
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(
        async (
          milliseconds: number,
          context: PreviewObserverCallContext,
        ) => {
          observedSleeps.push({
            milliseconds,
            deadlineMonotonic: context.deadlineMonotonic,
          });
          monotonic = 120_001;
        },
      ),
      listRuns: vi.fn(async () => ({ workflow_runs: [] })),
      readRun: vi.fn(async () => candidate),
      listJobs: vi.fn(async () => ({ jobs: [] })),
    };
    const controller = new AbortController();

    await expect(
      resolvePreviewObserverRun(
        {
          expectedWorkflow: candidate.path,
          expectedCommit: candidate.head_sha,
          dispatchStartedAt: new Date(
            Date.parse(candidate.created_at) - 1_000,
          ),
          dispatchCompletedAt: new Date(
            Date.parse(candidate.created_at) + 1_000,
          ),
          family: "role_probe",
        },
        deps,
        {
          deadlineMonotonic: 5,
          signal: controller.signal,
        },
      ),
    ).rejects.toThrow();

    expect(observedSleeps).toEqual([
      {
        milliseconds: 5,
        deadlineMonotonic: 5,
      },
    ]);
  });

  it("caps every standalone state reader at a shorter outer deadline", async () => {
    const candidate = run();
    const observedDeadlines: number[] = [];
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => 0,
      sleep: vi.fn(async () => undefined),
      listRuns: vi.fn(async () => ({ workflow_runs: [] })),
      readRun: vi.fn(async () => candidate),
      listJobs: vi.fn(
        async (
          _handle: Parameters<
            PreviewObserverResolutionDependencies["listJobs"]
          >[0],
          context: PreviewObserverCallContext,
        ) => {
          observedDeadlines.push(context.deadlineMonotonic);
          return { jobs: [] };
        },
      ),
    };
    const controller = new AbortController();
    const outer = {
      deadlineMonotonic: 5,
      signal: controller.signal,
    };
    const handle = candidate.id as Parameters<
      typeof readPreviewSignalObserverState
    >[0];
    const tick = new Date(candidate.created_at);

    await expect(
      readPreviewSignalObserverState(handle, "role_probe", deps, outer),
    ).rejects.toThrow();
    await expect(
      readPreviewTwoJobObserverState(handle, "restore", deps, outer),
    ).rejects.toThrow();
    await expect(
      readPreviewMaintenanceObserverState(
        handle,
        "calendar_maintenance",
        tick,
        deps,
        outer,
      ),
    ).rejects.toThrow();

    expect(observedDeadlines).toEqual([5, 5, 5]);
  });

  it("rejects a pre-aborted outer boundary before provider reads", async () => {
    const candidate = run();
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => 0,
      sleep: vi.fn(async () => undefined),
      listRuns: vi.fn(async () => ({ workflow_runs: [] })),
      readRun: vi.fn(async () => candidate),
      listJobs: vi.fn(async () => ({ jobs: [] })),
    };
    const controller = new AbortController();
    controller.abort();
    const outer = {
      deadlineMonotonic: 5,
      signal: controller.signal,
    };
    const handle = candidate.id as Parameters<
      typeof readPreviewSignalObserverState
    >[0];

    await expect(
      readPreviewSignalObserverState(handle, "role_probe", deps, outer),
    ).rejects.toThrow();
    await expect(
      readPreviewTwoJobObserverState(handle, "sync_suppression", deps, outer),
    ).rejects.toThrow();
    await expect(
      readPreviewMaintenanceObserverState(
        handle,
        "calendar_maintenance",
        new Date(candidate.created_at),
        deps,
        outer,
      ),
    ).rejects.toThrow();

    expect(deps.listJobs).not.toHaveBeenCalled();
  });

  it("propagates a live outer abort and waits for the provider call to settle", async () => {
    const candidate = run();
    let providerContext: PreviewObserverCallContext | null = null;
    let releaseProvider: (() => void) | null = null;
    let providerSettled = false;
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => 0,
      sleep: vi.fn(async () => undefined),
      listRuns: vi.fn(async () => ({ workflow_runs: [] })),
      readRun: vi.fn(async () => candidate),
      listJobs: vi.fn(
        async (
          _handle: Parameters<
            PreviewObserverResolutionDependencies["listJobs"]
          >[0],
          context: PreviewObserverCallContext,
        ) => {
          providerContext = context;
          await new Promise<void>((resolveProvider) => {
            releaseProvider = () => {
              providerSettled = true;
              resolveProvider();
            };
          });
          return { jobs: [] };
        },
      ),
    };
    const controller = new AbortController();
    const handle = candidate.id as Parameters<
      typeof readPreviewSignalObserverState
    >[0];
    const readPromise = readPreviewSignalObserverState(
      handle,
      "role_probe",
      deps,
      {
        deadlineMonotonic: 5,
        signal: controller.signal,
      },
    );
    let readSettled = false;
    const trackedRead = readPromise.then(
      () => {
        readSettled = true;
      },
      () => {
        readSettled = true;
      },
    );

    await vi.waitFor(() => {
      expect(providerContext).not.toBeNull();
    });
    controller.abort();
    await Promise.resolve();

    expect((providerContext as PreviewObserverCallContext | null)?.signal.aborted)
      .toBe(true);
    expect(readSettled).toBe(false);

    (releaseProvider as (() => void) | null)?.();
    await expect(readPromise).rejects.toThrow();
    await trackedRead;
    expect(providerSettled).toBe(true);
  });
});
import { once } from "node:events";

describe("full provider job-list resolution", () => {
  it.each([
    ["sync_suppression", ["signal", "uniqueness"]],
    ["restore", ["signal", "uniqueness"]],
    ["role_probe", ["signal"]],
  ] as const)(
    "ignores only completed skipped duplicates for %s",
    async (family, activeKinds) => {
      const candidate = run();
      const allNames = [
        "Capture sync_suppression signal",
        "Capture sync_suppression uniqueness",
        "Capture restore signal",
        "Capture restore uniqueness",
        "Capture role_probe signal",
      ];
      const fullJobs = allNames.map((name) =>
        job(name, "completed", "skipped"),
      );
      fullJobs.push(
        ...activeKinds.map((kind) => job(`Capture ${family} ${kind}`)),
      );
      const deps = dependencies([candidate], fullJobs);

      await expect(
        resolvePreviewObserverRun(
          {
            expectedWorkflow: candidate.path,
            expectedCommit: candidate.head_sha,
            dispatchStartedAt: new Date(
              Date.parse(candidate.created_at) - 1_000,
            ),
            dispatchCompletedAt: new Date(
              Date.parse(candidate.created_at) + 1_000,
            ),
            family,
          },
          deps,
        ),
      ).resolves.toBe(candidate.id);
    },
  );
});
import { resolve } from "node:path";

describe("conservative uniqueness close timestamps", () => {
  it("returns no uniqueness close until provider evidence anchors one", async () => {
    const candidate = run();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(candidate.created_at));
      const listeningDeps = dependencies(
        [],
        [
          job("Capture sync_suppression signal"),
          job("Capture sync_suppression uniqueness"),
        ],
      );
      const handle = candidate.id as Parameters<
        typeof readPreviewTwoJobObserverState
      >[0];
      const firstListening = await readPreviewTwoJobObserverState(
        handle,
        "sync_suppression",
        listeningDeps,
      );
      vi.setSystemTime(new Date(Date.now() + 5_000));
      const secondListening = await readPreviewTwoJobObserverState(
        handle,
        "sync_suppression",
        listeningDeps,
      );

      expect(firstListening.uniquenessClosesAt).toBeNull();
      expect(secondListening.uniquenessClosesAt).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    const signal = job(
      "Capture sync_suppression signal",
      "completed",
      "success",
    );
    const signalObservedAt = signal.steps[0]!.completed_at!;
    const deps = dependencies(
      [],
      [
        signal,
        job("Capture sync_suppression uniqueness"),
      ],
    );

    const state = await readPreviewTwoJobObserverState(
      candidate.id as Parameters<
        typeof readPreviewTwoJobObserverState
      >[0],
      "sync_suppression",
      deps,
    );

    expect(state.uniquenessClosesAt).toEqual(
      new Date(Date.parse(signalObservedAt) + 120_999),
    );
  });

  it.each([
    ["uniqueness-only", false],
    ["simultaneous signal and uniqueness", true],
  ] as const)(
    "rejects a future uniqueness completion from %s provider state",
    async (_label, signalSucceeded) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-07-30T18:00:11.500Z"));
        const signal = job(
          "Capture restore signal",
          signalSucceeded ? "completed" : "in_progress",
          signalSucceeded ? "success" : null,
        );
        const uniqueness = job(
          "Capture restore uniqueness",
          "completed",
          "success",
        );
        uniqueness.steps[0]!.completed_at = "2026-07-30T18:00:12Z";
        const deps = dependencies([], [signal, uniqueness]);

        await expect(
          readPreviewTwoJobObserverState(
            "41" as never,
            "restore",
            deps,
          ),
        ).rejects.toThrow("Preview observer metadata is invalid.");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("samples provider-read wall time after an advancing metadata call", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-30T18:00:11.500Z"));
      const signal = job("Capture restore signal");
      const uniqueness = job(
        "Capture restore uniqueness",
        "completed",
        "success",
      );
      uniqueness.steps[0]!.completed_at = "2026-07-30T18:00:12Z";
      const deps = dependencies([], [signal, uniqueness]);
      deps.listJobs = vi.fn(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
        return { jobs: [signal, uniqueness] };
      });

      await expect(
        readPreviewTwoJobObserverState(
          "41" as never,
          "restore",
          deps,
        ),
      ).resolves.toStrictEqual({
        signal: "listening",
        uniqueness: "succeeded",
        signalObservedAt: null,
        uniquenessClosesAt: new Date("2026-07-30T18:00:12.999Z"),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the signal-derived close when uniqueness succeeds on schedule", async () => {
    const candidate = run();
    const signal = job("Capture restore signal", "completed", "success");
    const signalObservedAt = signal.steps[0]!.completed_at!;
    const uniqueness = job(
      "Capture restore uniqueness",
      "completed",
      "success",
    );
    uniqueness.steps[0]!.completed_at = new Date(
      Date.parse(signalObservedAt) + 120_000,
    )
      .toISOString()
      .replace(".000Z", "Z");
    const deps = dependencies([], [signal, uniqueness]);

    const state = await readPreviewTwoJobObserverState(
      candidate.id as Parameters<
        typeof readPreviewTwoJobObserverState
      >[0],
      "restore",
      deps,
    );

    expect(state.uniquenessClosesAt).toEqual(
      new Date(Date.parse(signalObservedAt) + 120_999),
    );
  });

  it("moves forward for a late uniqueness completion and remains stable", async () => {
    const candidate = run();
    const signal = job("Capture restore signal", "completed", "success");
    const signalObservedAt = signal.steps[0]!.completed_at!;
    const uniqueness = job(
      "Capture restore uniqueness",
      "completed",
      "success",
    );
    const uniquenessCompletedAt = new Date(
      Date.parse(signalObservedAt) + 121_000,
    )
      .toISOString()
      .replace(".000Z", "Z");
    uniqueness.steps[0]!.completed_at = uniquenessCompletedAt;
    const deps = dependencies([], [signal, uniqueness]);
    const handle = candidate.id as Parameters<
      typeof readPreviewTwoJobObserverState
    >[0];

    const first = await readPreviewTwoJobObserverState(
      handle,
      "restore",
      deps,
    );
    const second = await readPreviewTwoJobObserverState(
      handle,
      "restore",
      deps,
    );
    const expected = new Date(Date.parse(uniquenessCompletedAt) + 999);

    expect(first.uniquenessClosesAt).toEqual(expected);
    expect(second.uniquenessClosesAt).toEqual(expected);
  });

  it("rejects backward raw uniqueness completion evidence as provider time advances", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-30T18:03:00.000Z"));
      const signal = job("Capture restore signal", "completed", "success");
      const firstUniqueness = job(
        "Capture restore uniqueness",
        "completed",
        "success",
      );
      firstUniqueness.steps[0]!.completed_at = "2026-07-30T18:02:11Z";
      const backwardUniqueness = job(
        "Capture restore uniqueness",
        "completed",
        "success",
      );
      backwardUniqueness.steps[0]!.completed_at = "2026-07-30T18:02:10Z";
      let reads = 0;
      const deps = dependencies([], []);
      deps.listJobs = vi.fn(async () => ({
        jobs: [signal, reads++ === 0 ? firstUniqueness : backwardUniqueness],
      }));
      const handle = "41" as Parameters<
        typeof readPreviewTwoJobObserverState
      >[0];

      await expect(
        readPreviewTwoJobObserverState(handle, "restore", deps),
      ).resolves.toMatchObject({
        uniquenessClosesAt: new Date("2026-07-30T18:02:11.999Z"),
      });
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(
        readPreviewTwoJobObserverState(handle, "restore", deps),
      ).rejects.toThrow("Preview observer metadata is invalid.");
    } finally {
      vi.useRealTimers();
    }
  });
});
import { describe, expect, it, vi } from "vitest";
import {
  createGitHubObserverResolutionDependencies,
  parsePreviewObserverRunArguments,
  readPreviewAiObserverState,
  readPreviewMaintenanceObserverState,
  readPreviewSignalObserverState,
  readPreviewTwoJobObserverState,
  resolvePreviewObserverRun,
  runCapturedProviderCommand,
  runPreviewObserverCli,
  type PreviewObserverCallContext,
  type PreviewObserverCommandRunner,
  type PreviewObserverResolutionDependencies,
} from "../../../scripts/resolve-preview-observer-run";

describe("captured provider command boundary", () => {
  it("rounds fractional remaining milliseconds before spawning", async () => {
    await expect(
      runCapturedProviderCommand(
        process.execPath,
        ["-e", "process.stdout.write('ok')"],
        {
          deadlineMonotonic: 10_000.5,
          signal: new AbortController().signal,
        },
        () => 0,
      ),
    ).resolves.toMatchObject({ stdout: "ok", stderr: "" });
  });
});

describe("AI observer metadata state", () => {
  it("requires the exact concurrent signal and uniqueness jobs", async () => {
    const candidate = run();
    const signal = job("Capture ai_usage signal");
    const uniqueness = job("Capture ai_usage uniqueness");
    const deps = dependencies([], [signal, uniqueness]);
    const handle = candidate.id as Parameters<
      typeof readPreviewAiObserverState
    >[0];

    await expect(
      readPreviewAiObserverState(handle, deps),
    ).resolves.toStrictEqual({
      signal: "listening",
      uniqueness: "listening",
      signalObservedAt: null,
    });

    const incomplete = dependencies([], [signal]);
    await expect(
      readPreviewAiObserverState(handle, incomplete),
    ).rejects.toThrow("Preview observer metadata is invalid.");
  });

  it("returns only allowlisted signal state and listener completion time", async () => {
    const candidate = run();
    const signal = job("Capture ai_usage signal", "completed", "success");
    signal.steps[0]!.completed_at = "2026-07-30T18:00:06Z";
    const uniqueness = job("Capture ai_usage uniqueness");
    const deps = dependencies([], [signal, uniqueness]);

    await expect(
      readPreviewAiObserverState(
        candidate.id as Parameters<typeof readPreviewAiObserverState>[0],
        deps,
      ),
    ).resolves.toStrictEqual({
      signal: "succeeded",
      uniqueness: "listening",
      signalObservedAt: new Date("2026-07-30T18:00:06.000Z"),
    });
  });
});

const SHA = "a".repeat(40);
const START = new Date("2026-07-30T18:00:00.000Z");
const END = new Date("2026-07-30T18:00:02.000Z");
const TICK = new Date("2026-07-30T18:15:00.000Z");

/** Runs the real resolver entrypoint while capturing both process streams. */
async function runResolverCli(arguments_: readonly string[]): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(process.cwd(), "scripts", "resolve-preview-observer-run.ts"),
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
  it.each([
    ["zero milliseconds", "2026-07-30T18:00:00.000Z"],
    ["nonzero milliseconds", "2026-07-30T18:00:00.123Z"],
  ] as const)(
    "parses canonical millisecond CLI dispatch bounds with %s",
    (_label, instant) => {
      const parsed = parsePreviewObserverRunArguments([
        "--repository",
        "owner/repository",
        "--workflow",
        ".github/workflows/preview.yml",
        "--sha",
        SHA,
        "--dispatch-started-at",
        instant,
        "--dispatch-completed-at",
        "2026-07-30T18:00:02.456Z",
        "--family",
        "foundation_probe",
      ]);

      expect(parsed.dispatchStartedAt).toEqual(new Date(instant));
      expect(parsed.dispatchCompletedAt).toEqual(
        new Date("2026-07-30T18:00:02.456Z"),
      );
    },
  );

  it.each([
    "2026-07-30T18:00:00Z",
    "2026-07-30T18:00:00.00Z",
    "2026-07-30T18:00:00.0000Z",
  ])("rejects noncanonical CLI dispatch precision: %s", (instant) => {
    expect(() =>
      parsePreviewObserverRunArguments([
        "--repository",
        "owner/repository",
        "--workflow",
        ".github/workflows/preview.yml",
        "--sha",
        SHA,
        "--dispatch-started-at",
        instant,
        "--dispatch-completed-at",
        "2026-07-30T18:00:02.000Z",
        "--family",
        "foundation_probe",
      ])
    ).toThrow("Preview observer metadata is invalid.");
  });

  it.each([
    ["zero milliseconds", "2026-07-30T18:00:00.000Z"],
    ["nonzero milliseconds", "2026-07-30T18:00:00.123Z"],
  ] as const)(
    "runs the exported CLI path with %s",
    async (_label, dispatchStartedAt) => {
      const createDependencies = vi.fn(() =>
        dependencies(
          [run()],
          [job("Capture foundation_probe signal")],
        )
      );
      await expect(runPreviewObserverCli([
        "--repository",
        "owner/repository",
        "--workflow",
        ".github/workflows/preview.yml",
        "--sha",
        SHA,
        "--dispatch-started-at",
        dispatchStartedAt,
        "--dispatch-completed-at",
        "2026-07-30T18:00:02.456Z",
        "--family",
        "foundation_probe",
      ], createDependencies)).resolves.toBe(0);
      expect(createDependencies).toHaveBeenCalledOnce();
    },
  );

  it("accepts a canonical millisecond maintenance input through the exported CLI path", async () => {
    const createDependencies = vi.fn(() =>
      dependencies(
        [run()],
        [job("Capture calendar_maintenance uniqueness")],
      )
    );
    await expect(runPreviewObserverCli([
      "--repository",
      "owner/repository",
      "--workflow",
      ".github/workflows/preview.yml",
      "--sha",
      SHA,
      "--dispatch-started-at",
      "2026-07-30T18:00:00.000Z",
      "--dispatch-completed-at",
      "2026-07-30T18:00:02.456Z",
      "--family",
      "calendar_maintenance",
      "--maintenance-scheduled-at",
      "2026-07-30T18:15:00.123Z",
    ], createDependencies)).resolves.toBe(0);
    expect(createDependencies).toHaveBeenCalledOnce();
  });

  it("fails the real CLI before provider access for invalid dispatch precision", async () => {
    const result = await runResolverCli([
      "--repository",
      "owner/repository",
      "--workflow",
      ".github/workflows/preview.yml",
      "--sha",
      SHA,
      "--dispatch-started-at",
      "2026-07-30T18:00:00Z",
      "--dispatch-completed-at",
      "2026-07-30T18:00:02.000Z",
      "--family",
      "foundation_probe",
    ]);
    expect(result).toEqual({ exitCode: 1, stdout: "", stderr: "" });
  });

  it("treats one provider-created second as an interval overlapping a millisecond dispatch bound", async () => {
    const overlappingRun = {
      ...run(),
      created_at: "2026-07-30T18:00:00Z",
    };
    const deps = dependencies(
      [overlappingRun],
      [job("Capture foundation_probe signal")],
    );
    deps.readRun = vi.fn(async () => overlappingRun);

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: new Date("2026-07-30T18:00:00.500Z"),
      dispatchCompletedAt: new Date("2026-07-30T18:00:00.750Z"),
      family: "foundation_probe",
    }, deps)).resolves.toBe("41");
  });

  it("continues pagination through the dispatch lower-bound second and exposes a same-second duplicate", async () => {
    let monotonic = 0;
    const lowerBoundBucket = Array.from({ length: 100 }, (_, index) => ({
      ...(index === 99
        ? run("41")
        : unrelatedRun(String(3_000 + index))),
      created_at: "2026-07-30T18:00:00Z",
    }));
    const listRuns = vi.fn(async (page = 1) => ({
      workflow_runs:
        page === 1
          ? lowerBoundBucket
          : [{
              ...run("42"),
              created_at: "2026-07-30T18:00:00Z",
            }],
    }));
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns,
      readRun: vi.fn(async (handle) => ({
        ...run(String(handle)),
        created_at: "2026-07-30T18:00:00Z",
      })),
      listJobs: vi.fn(async () => ({
        jobs: [job("Capture foundation_probe signal")],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: new Date("2026-07-30T18:00:00.500Z"),
      dispatchCompletedAt: new Date("2026-07-30T18:00:00.750Z"),
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");
    expect(listRuns).toHaveBeenCalledWith(2, expect.anything());
  });

  it("uses exact provider projections and gives each command a bounded abort signal", async () => {
    const calls: Array<{
      readonly arguments_: readonly string[];
      readonly context: PreviewObserverCallContext;
    }> = [];
    const responses = [
      { workflow_runs: [run()] },
      run(),
      { jobs: [job("Capture foundation_probe signal")] },
    ];
    const runCommand: PreviewObserverCommandRunner = vi.fn(
      async (_executable, arguments_, context) => {
        calls.push({ arguments_: [...arguments_], context });
        return {
          stdout: JSON.stringify(responses.shift()),
          stderr: "discarded-provider-canary",
        };
      },
    );
    const dependencies = createGitHubObserverResolutionDependencies({
      repository: "owner/repository",
      executable: "provider-cli",
      monotonicNow: () => 0,
      runCommand,
    });
    const controller = new AbortController();
    const context = Object.freeze({
      deadlineMonotonic: 10_000,
      signal: controller.signal,
    });

    await expect(dependencies.listRuns(1, context)).resolves.toEqual({
      workflow_runs: [run()],
    });
    await expect(
      dependencies.readRun("41" as never, context),
    ).resolves.toEqual(run());
    await expect(
      dependencies.listJobs("41" as never, context),
    ).resolves.toEqual({
      jobs: [job("Capture foundation_probe signal")],
    });

    expect(calls.map(({ arguments_ }) => arguments_)).toEqual([
      [
        "api",
        "-X",
        "GET",
        "repos/owner/repository/actions/runs",
        "-f",
        "event=workflow_dispatch",
        "-f",
        "per_page=100",
        "-f",
        "page=1",
        "--jq",
        "{workflow_runs: [.workflow_runs[] | {id,event,head_sha,created_at,path,status,conclusion}]}",
      ],
      [
        "api",
        "-X",
        "GET",
        "repos/owner/repository/actions/runs/41",
        "--jq",
        "{id,event,head_sha,created_at,path,status,conclusion}",
      ],
      [
        "api",
        "-X",
        "GET",
        "repos/owner/repository/actions/runs/41/jobs",
        "-f",
        "per_page=100",
        "--jq",
        "{jobs: [.jobs[] | {name,status,conclusion,steps: [.steps[] | {name,status,conclusion,completed_at}]}]}",
      ],
    ]);
    for (const call of calls) {
      expect(call.context).not.toBe(context);
      expect(call.context.signal).not.toBe(controller.signal);
      expect(call.context.signal.aborted).toBe(true);
      expect(call.context.deadlineMonotonic).toBe(10_000);
    }
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborts an injected provider command at its deadline and waits for settlement", async () => {
    vi.useFakeTimers();
    try {
      let commandContext: PreviewObserverCallContext | undefined;
      let releaseCommand: (() => void) | undefined;
      let readSettled = false;
      const runCommand: PreviewObserverCommandRunner = vi.fn(
        async (_executable, _arguments, context) => {
          commandContext = context;
          await new Promise<void>((_resolvePromise, rejectPromise) => {
            releaseCommand = () => rejectPromise(
              new Error("discarded-provider-canary"),
            );
          });
          throw new Error("unreachable-provider-canary");
        },
      );
      const dependencies = createGitHubObserverResolutionDependencies({
        repository: "owner/repository",
        executable: "provider-cli",
        monotonicNow: () => 0,
        runCommand,
      });
      const read = dependencies.listRuns(1, Object.freeze({
        deadlineMonotonic: 10,
        signal: new AbortController().signal,
      }));
      const tracked = read.then(
        () => { readSettled = true; },
        () => { readSettled = true; },
      );

      await vi.advanceTimersByTimeAsync(10);
      expect(commandContext?.signal.aborted).toBe(true);
      expect(readSettled).toBe(false);

      releaseCommand?.();
      await expect(read).rejects.toThrow(
        "Preview observer metadata is invalid.",
      );
      await tracked;
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates outer cancellation to an injected command and waits for settlement", async () => {
    let commandContext: PreviewObserverCallContext | undefined;
    let releaseCommand: (() => void) | undefined;
    let readSettled = false;
    const runCommand: PreviewObserverCommandRunner = vi.fn(
      async (_executable, _arguments, context) => {
        commandContext = context;
        await new Promise<void>((_resolvePromise, rejectPromise) => {
          releaseCommand = () => rejectPromise(
            new Error("discarded-provider-canary"),
          );
        });
        throw new Error("unreachable-provider-canary");
      },
    );
    const dependencies = createGitHubObserverResolutionDependencies({
      repository: "owner/repository",
      executable: "provider-cli",
      monotonicNow: () => 0,
      runCommand,
    });
    const controller = new AbortController();
    const read = dependencies.listRuns(1, Object.freeze({
      deadlineMonotonic: 10_000,
      signal: controller.signal,
    }));
    const tracked = read.then(
      () => { readSettled = true; },
      () => { readSettled = true; },
    );

    await vi.waitFor(() => expect(commandContext).toBeDefined());
    controller.abort();
    await new Promise<void>((resolvePromise) => {
      setImmediate(resolvePromise);
    });
    expect(commandContext?.signal.aborted).toBe(true);
    expect(readSettled).toBe(false);

    releaseCommand?.();
    await expect(read).rejects.toThrow(
      "Preview observer metadata is invalid.",
    );
    await tracked;
  });

  it.each([
    [
      "run-list envelope",
      "listRuns",
      { workflow_runs: [run()], provider_canary: "must-not-cross" },
    ],
    [
      "run record",
      "readRun",
      { ...run(), provider_canary: "must-not-cross" },
    ],
    [
      "job-list envelope",
      "listJobs",
      {
        jobs: [job("Capture foundation_probe signal")],
        provider_canary: "must-not-cross",
      },
    ],
    [
      "job record",
      "listJobs",
      {
        jobs: [{
          ...job("Capture foundation_probe signal"),
          provider_canary: "must-not-cross",
        }],
      },
    ],
    [
      "step record",
      "listJobs",
      {
        jobs: [{
          ...job("Capture foundation_probe signal"),
          steps: [{
            ...job("Capture foundation_probe signal").steps[0],
            provider_canary: "must-not-cross",
          }],
        }],
      },
    ],
  ] as const)(
    "rejects a projected provider canary on the %s inside the adapter boundary",
    async (_label, operation, payload) => {
      const runCommand: PreviewObserverCommandRunner = vi.fn(async () => ({
        stdout: JSON.stringify(payload),
        stderr: "",
      }));
      const dependencies = createGitHubObserverResolutionDependencies({
        repository: "owner/repository",
        executable: "provider-cli",
        monotonicNow: () => 0,
        runCommand,
      });
      const context = Object.freeze({
        deadlineMonotonic: 10_000,
        signal: new AbortController().signal,
      });
      const read =
        operation === "listRuns"
          ? dependencies.listRuns(1, context)
          : operation === "readRun"
            ? dependencies.readRun("41" as never, context)
            : dependencies.listJobs("41" as never, context);

      await expect(read).rejects.toThrow(
        "Preview observer metadata is invalid.",
      );
    },
  );

  it.each(["listRuns", "readRun", "listJobs"] as const)(
    "aborts and settles a never-resolving %s provider call at the shared absolute deadline",
    async (blockedCall) => {
      vi.useFakeTimers();
      try {
        let callContext: PreviewObserverCallContext | undefined;
        let terminationObserved = false;
        const never = (_value: unknown, context: PreviewObserverCallContext) => {
          callContext = context;
          return new Promise<never>((_resolvePromise, rejectPromise) => {
            context.signal.addEventListener("abort", () => {
              terminationObserved = true;
              rejectPromise(new Error("discarded-provider-canary"));
            }, { once: true });
          });
        };
        const deps: PreviewObserverResolutionDependencies = {
          monotonicNow: () => 0,
          sleep: vi.fn(async () => undefined),
          listRuns:
            blockedCall === "listRuns"
              ? vi.fn(never)
              : vi.fn(async () => ({ workflow_runs: [run()] })),
          readRun:
            blockedCall === "readRun"
              ? vi.fn(never)
              : vi.fn(async () => run()),
          listJobs:
            blockedCall === "listJobs"
              ? vi.fn(never)
              : vi.fn(async () => ({
                  jobs: [job("Capture foundation_probe signal")],
                })),
        };
        let rejection: unknown;
        const pending = resolvePreviewObserverRun({
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: SHA,
          dispatchStartedAt: START,
          dispatchCompletedAt: END,
          family: "foundation_probe",
        }, deps).catch((error: unknown) => {
          rejection = error;
        });

        await vi.advanceTimersByTimeAsync(120_000);
        await pending;

        expect(rejection).toBeInstanceOf(Error);
        expect((rejection as Error).message).toBe(
          "Preview observer metadata is invalid.",
        );
        expect(callContext?.deadlineMonotonic).toBe(120_000);
        expect(callContext?.signal.aborted).toBe(true);
        expect(terminationObserved).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("bounds a standalone observer-state metadata read with an interruptible absolute deadline", async () => {
    vi.useFakeTimers();
    try {
      let callContext: PreviewObserverCallContext | undefined;
      const deps: PreviewObserverResolutionDependencies = {
        monotonicNow: () => 50,
        sleep: vi.fn(async () => undefined),
        listRuns: vi.fn(async () => ({ workflow_runs: [] })),
        readRun: vi.fn(async () => run()),
        listJobs: vi.fn((_handle, context) => {
          callContext = context;
          return new Promise<never>((_resolvePromise, rejectPromise) => {
            context.signal.addEventListener(
              "abort",
              () => rejectPromise(new Error("discarded-provider-canary")),
              { once: true },
            );
          });
        }),
      };
      let rejection: unknown;
      const pending = readPreviewSignalObserverState(
        "41" as never,
        "foundation_probe",
        deps,
      ).catch((error: unknown) => {
        rejection = error;
      });

      await vi.advanceTimersByTimeAsync(120_000);
      await pending;

      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toBe(
        "Preview observer metadata is invalid.",
      );
      expect(callContext?.deadlineMonotonic).toBe(120_050);
      expect(callContext?.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives the inclusive terminal poll one fixed settlement cap without renewing the 120-second close", async () => {
    vi.useFakeTimers();
    try {
      let monotonic = 0;
      let calls = 0;
      let terminalContext: PreviewObserverCallContext | undefined;
      const deps: PreviewObserverResolutionDependencies = {
        monotonicNow: () => monotonic,
        sleep: vi.fn(async (milliseconds) => {
          monotonic += milliseconds;
        }),
        listRuns: vi.fn((_page, context) => {
          calls += 1;
          if (calls === 25) {
            terminalContext = context;
            return new Promise<never>((_resolvePromise, rejectPromise) => {
              context.signal.addEventListener(
                "abort",
                () => rejectPromise(new Error("discarded-provider-canary")),
                { once: true },
              );
            });
          }
          return Promise.resolve({ workflow_runs: [run()] });
        }),
        readRun: vi.fn(async () => run()),
        listJobs: vi.fn(async () => ({
          jobs: [job("Capture foundation_probe signal")],
        })),
      };
      let rejection: unknown;
      const pending = resolvePreviewObserverRun({
        expectedWorkflow: ".github/workflows/preview.yml",
        expectedCommit: SHA,
        dispatchStartedAt: START,
        dispatchCompletedAt: END,
        family: "foundation_probe",
      }, deps).catch((error: unknown) => {
        rejection = error;
      });
      for (let index = 0; index < 500 && calls < 25; index += 1) {
        await Promise.resolve();
      }

      expect(calls).toBe(25);
      expect(monotonic).toBe(120_000);
      expect(terminalContext?.deadlineMonotonic).toBe(180_000);

      await vi.advanceTimersByTimeAsync(60_000);
      await pending;
      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toBe(
        "Preview observer metadata is invalid.",
      );
      expect(terminalContext?.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

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
    expect(deps.sleep).toHaveBeenCalledWith(5_000, expect.anything());
    expect(deps.readRun).toHaveBeenCalledOnce();
    expect(deps.listJobs).toHaveBeenCalledOnce();
  });

  it("retains one matching run while its exact listener topology starts", async () => {
    let monotonic = 0;
    let jobReads = 0;
    const activeSignal = job("Capture sync_suppression signal");
    const activeUniqueness = job("Capture sync_suppression uniqueness");
    const queuedSignal = job(
      "Capture sync_suppression signal",
      "queued",
      null,
    );
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns: vi.fn(async () => ({ workflow_runs: [run()] })),
      readRun: vi.fn(async () => run()),
      listJobs: vi.fn(async () => {
        jobReads += 1;
        if (jobReads === 1) return { jobs: [] };
        if (jobReads === 2) return { jobs: [queuedSignal] };
        return { jobs: [activeSignal, activeUniqueness] };
      }),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "sync_suppression",
    }, deps)).resolves.toBe("41");

    expect(jobReads).toBe(25);
    expect(deps.sleep).toHaveBeenCalledTimes(24);
    expect(deps.readRun).toHaveBeenCalledTimes(25);
  });

  it("rejects a queued run as soon as its exact listener topology becomes active", async () => {
    let monotonic = 0;
    let jobReads = 0;
    const queuedRun = { ...run(), status: "queued" };
    const activeSignal = job("Capture restore signal");
    const activeUniqueness = job("Capture restore uniqueness");
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns: vi.fn(async () => ({ workflow_runs: [queuedRun] })),
      readRun: vi.fn(async () => queuedRun),
      listJobs: vi.fn(async () => ({
        jobs:
          jobReads++ === 0
            ? [job("Capture restore signal", "queued")]
            : [activeSignal, activeUniqueness],
      })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "restore",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");

    expect(monotonic).toBe(5_000);
    expect(deps.sleep).toHaveBeenCalledOnce();
    expect(deps.listJobs).toHaveBeenCalledTimes(2);
  });

  it("fails immediately when the uniquely attributed observer run is terminal", async () => {
    let monotonic = 0;
    const terminalRun = {
      ...run(),
      status: "completed",
      conclusion: "failure",
    };
    const deps: PreviewObserverResolutionDependencies = {
      monotonicNow: () => monotonic,
      sleep: vi.fn(async (milliseconds) => {
        monotonic += milliseconds;
      }),
      listRuns: vi.fn(async () => ({ workflow_runs: [terminalRun] })),
      readRun: vi.fn(async () => terminalRun),
      listJobs: vi.fn(async () => ({ jobs: [] })),
    };

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");

    expect(deps.sleep).not.toHaveBeenCalled();
    expect(deps.readRun).toHaveBeenCalledOnce();
    expect(deps.listJobs).not.toHaveBeenCalled();
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
    expect(listRuns).toHaveBeenCalledWith(2, expect.anything());
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
    expect(listRuns).toHaveBeenCalledWith(2, expect.anything());
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
    expect(listRuns).toHaveBeenCalledWith(10, expect.anything());
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
    expect(listRuns).toHaveBeenCalledWith(2, expect.anything());
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

  it("rejects an expected skipped capture job as contradictory without polling", async () => {
    const deps = dependencies([run()], [
      job("Capture foundation_probe signal", "completed", "skipped"),
    ]);

    await expect(resolvePreviewObserverRun({
      expectedWorkflow: ".github/workflows/preview.yml",
      expectedCommit: SHA,
      dispatchStartedAt: START,
      dispatchCompletedAt: END,
      family: "foundation_probe",
    }, deps)).rejects.toThrow("Preview observer metadata is invalid.");

    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it.each([
    [[]],
    [[run("41"), run("42")]],
    [[{ ...run(), head_sha: "b".repeat(40) }]],
    [[{ ...run(), event: "push" }]],
    [[{ ...run(), created_at: "2026-07-30T17:59:59Z" }]],
    [[{ ...run(), created_at: "2026-07-30T18:00:01.001Z" }]],
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
      uniquenessClosesAt: expect.any(Date),
      signalObservedAt: new Date("2026-07-30T18:00:10.000Z"),
    });
  });

  it(
    "accepts and preserves maintenance provider completion only at the semantic close",
    async () => {
      const maintenance = job(
        "Capture calendar_maintenance uniqueness",
        "completed",
        "success",
      );
      maintenance.steps[0]!.completed_at = new Date(
        TICK.getTime() + 120_000,
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
        maintenanceCompletedAt: new Date(TICK.getTime() + 120_000),
      });
    },
  );

  it.each([
    ["one millisecond before the close", 120_000 - 1],
    ["one millisecond after the close", 120_000 + 1],
    ["one full second after the close", 121_000],
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
