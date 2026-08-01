import { describe, expect, it, vi } from "vitest";
import {
  runPreviewNormalDeploy,
  type PreviewNormalDeployCommandResult,
  type PreviewNormalDeployDependencies,
} from "../../../scripts/run-preview-normal-deploy";

const BRANCH = "codex/phase-b-foundation" as const;
const COMMIT = "b".repeat(40);
const OTHER_COMMIT = "c".repeat(40);
const REF = "refs/heads/codex/phase-b-foundation";
const WORKFLOW = ".github/workflows/preview.yml";
const ARTIFACT = "preview-normal-deploy-attribution-v1";
const FAILURE = "Preview normal deploy failed closed.";
const START = "2026-07-31T18:00:00.000Z";
const DISPATCHED = "2026-07-31T18:00:01.000Z";
const RUN_CREATED = "2026-07-31T18:00:00.500Z";
const RUN_COMPLETED = "2026-07-31T18:02:00.000Z";
const ARTIFACT_CREATED = "2026-07-31T18:02:01.000Z";
const COMPLETE = "2026-07-31T18:02:02.000Z";

function line(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function child(
  value: unknown,
  overrides: Partial<PreviewNormalDeployCommandResult> = {},
): PreviewNormalDeployCommandResult {
  return { exitCode: 0, stdout: line(value), stderr: "", ...overrides };
}

function run(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "41",
    path: WORKFLOW,
    event: "workflow_dispatch",
    head_sha: COMMIT,
    status: "completed",
    conclusion: "success",
    created_at: RUN_CREATED,
    updated_at: RUN_COMPLETED,
    ...overrides,
  };
}

function responses(overrides: {
  readonly listedRuns?: unknown;
  readonly readRun?: unknown;
  readonly jobs?: unknown;
  readonly artifacts?: unknown;
  readonly attribution?: unknown;
} = {}): readonly PreviewNormalDeployCommandResult[] {
  return [
    child({ dispatched: true }),
    child(overrides.listedRuns ?? { complete: true, workflow_runs: [run()] }),
    child(overrides.readRun ?? run()),
    child(
      overrides.jobs ?? {
        total_count: 1,
        jobs: [
          {
            name: "Deploy normal preview",
            status: "completed",
            conclusion: "success",
            started_at: DISPATCHED,
            completed_at: RUN_COMPLETED,
          },
        ],
      },
    ),
    child(
      overrides.artifacts ?? {
        total_count: 1,
        artifacts: [
          {
            id: "51",
            name: ARTIFACT,
            expired: false,
            created_at: ARTIFACT_CREATED,
            workflow_run: { id: "41", head_sha: COMMIT },
          },
        ],
      },
    ),
    child(
      overrides.attribution ?? {
        version: "vision.preview-normal-deploy-attribution/v1",
        outcome: "deployed",
        reviewedCommit: COMMIT,
        startedAt: DISPATCHED,
        completedAt: RUN_COMPLETED,
      },
    ),
  ];
}

function harness(
  providerResponses: readonly PreviewNormalDeployCommandResult[] = responses(),
  options: {
    readonly remoteTip?: string;
    readonly times?: readonly string[];
  } = {},
): PreviewNormalDeployDependencies & {
  readonly events: string[];
  readonly providerArguments: readonly (readonly string[])[];
} {
  const queue = [...providerResponses];
  const events: string[] = [];
  const providerArguments: string[][] = [];
  const times = [...(options.times ?? [START, DISPATCHED, COMPLETE])];
  return {
    events,
    providerArguments,
    wallNow: vi.fn(() => new Date(times.shift() ?? COMPLETE)),
    monotonicNow: vi.fn(() => 0),
    gitRemoteDependencies: {
      runCommand: vi.fn(async (_executable, arguments_) => {
        events.push("remote-tip");
        expect(arguments_).toEqual([
          "ls-remote",
          "--heads",
          "origin",
          REF,
        ]);
        return {
          exitCode: 0,
          stdout: `${options.remoteTip ?? COMMIT}\t${REF}\n`,
          stderr: "discarded remote detail",
        };
      }),
    },
    runProviderCommand: vi.fn(async (arguments_) => {
      events.push(arguments_[0] === "dispatch" ? "dispatch" : "provider-read");
      providerArguments.push([...arguments_]);
      const next = queue.shift();
      if (next === undefined) throw new Error("private provider failure");
      return next;
    }),
  };
}

describe("permanent normal preview deploy runner", () => {
  it("deploys one exact commit and returns only the frozen safe result", async () => {
    const deps = harness();

    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).resolves.toEqual({
      outcome: "deployed",
      startedAt: START,
      completedAt: COMPLETE,
    });

    expect(deps.events.slice(0, 2)).toEqual(["remote-tip", "dispatch"]);
    expect(deps.providerArguments).toEqual([
      ["dispatch", WORKFLOW, BRANCH, `reviewed_preview_commit=${COMMIT}`],
      [
        "list-runs",
        WORKFLOW,
        "workflow_dispatch",
        BRANCH,
        START,
        DISPATCHED,
      ],
      ["read-run", "41"],
      ["list-jobs", "41"],
      ["list-artifacts", "41", ARTIFACT],
      ["read-artifact", "51"],
    ]);
  });

  it("rejects a moved remote tip before provider dispatch", async () => {
    const deps = harness(responses(), { remoteTip: OTHER_COMMIT });

    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
    expect(deps.providerArguments).toEqual([]);
  });

  it.each([
    ["zero runs", { complete: true, workflow_runs: [] }],
    [
      "duplicate in-window runs",
      { complete: true, workflow_runs: [run(), run({ id: "42" })] },
    ],
    [
      "wrong workflow",
      { complete: true, workflow_runs: [run({ path: "wrong.yml" })] },
    ],
    [
      "wrong event",
      { complete: true, workflow_runs: [run({ event: "push" })] },
    ],
    [
      "wrong commit",
      { complete: true, workflow_runs: [run({ head_sha: OTHER_COMMIT })] },
    ],
    [
      "stale run",
      {
        complete: true,
        workflow_runs: [run({ created_at: "2026-07-31T17:59:59.999Z" })],
      },
    ],
    [
      "late run",
      {
        complete: true,
        workflow_runs: [run({ created_at: "2026-07-31T18:00:01.001Z" })],
      },
    ],
  ])("rejects %s during bounded run resolution", async (_name, listedRuns) => {
    const deps = harness(responses({ listedRuns }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("selects the sole in-window run from a complete bounded history", async () => {
    const stale = run({
      id: "40",
      created_at: "2026-07-31T17:59:59.999Z",
      updated_at: "2026-07-31T17:59:59.999Z",
    });
    const deps = harness(
      responses({
        listedRuns: { complete: true, workflow_runs: [stale, run()] },
      }),
    );

    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).resolves.toEqual({
      outcome: "deployed",
      startedAt: START,
      completedAt: COMPLETE,
    });
  });

  it.each([
    ["explicitly incomplete", { complete: false, workflow_runs: [run()] }],
    ["missing completeness proof", { workflow_runs: [run()] }],
    [
      "truncated page metadata",
      { complete: true, has_more: true, workflow_runs: [run()] },
    ],
  ])("rejects %s bounded run history", async (_name, listedRuns) => {
    const deps = harness(responses({ listedRuns }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it.each([
    ["failed run", run({ conclusion: "failure" })],
    ["unfinished run", run({ status: "in_progress", conclusion: null })],
    ["mismatched run identity", run({ id: "42" })],
    ["mismatched immutable head", run({ head_sha: OTHER_COMMIT })],
    ["noncanonical completion", run({ updated_at: "2026-07-31 18:02:00Z" })],
  ])("rejects %s", async (_name, readRun) => {
    const deps = harness(responses({ readRun }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it.each([
    ["missing job", { total_count: 0, jobs: [] }],
    [
      "failed job",
      {
        total_count: 1,
        jobs: [
          {
            name: "Deploy normal preview",
            status: "completed",
            conclusion: "failure",
            started_at: DISPATCHED,
            completed_at: RUN_COMPLETED,
          },
        ],
      },
    ],
    [
      "wrong job",
      {
        total_count: 1,
        jobs: [
          {
            name: "Acceptance observer",
            status: "completed",
            conclusion: "success",
            started_at: DISPATCHED,
            completed_at: RUN_COMPLETED,
          },
        ],
      },
    ],
  ])("rejects %s", async (_name, jobs) => {
    const deps = harness(responses({ jobs }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("rejects a deploy job that starts before its containing run", async () => {
    const deps = harness(
      responses({
        jobs: {
          total_count: 1,
          jobs: [
            {
              name: "Deploy normal preview",
              status: "completed",
              conclusion: "success",
              started_at: "2026-07-31T18:00:00.499Z",
              completed_at: RUN_COMPLETED,
            },
          ],
        },
      }),
    );
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it.each([
    ["missing artifact", { total_count: 0, artifacts: [] }],
    [
      "duplicate artifact",
      {
        total_count: 2,
        artifacts: [
          {
            id: "51",
            name: ARTIFACT,
            expired: false,
            created_at: ARTIFACT_CREATED,
            workflow_run: { id: "41", head_sha: COMMIT },
          },
          {
            id: "52",
            name: ARTIFACT,
            expired: false,
            created_at: ARTIFACT_CREATED,
            workflow_run: { id: "41", head_sha: COMMIT },
          },
        ],
      },
    ],
    [
      "stale artifact",
      {
        total_count: 1,
        artifacts: [
          {
            id: "51",
            name: ARTIFACT,
            expired: false,
            created_at: "2026-07-31T17:59:59.999Z",
            workflow_run: { id: "41", head_sha: COMMIT },
          },
        ],
      },
    ],
    [
      "mismatched artifact commit",
      {
        total_count: 1,
        artifacts: [
          {
            id: "51",
            name: ARTIFACT,
            expired: false,
            created_at: ARTIFACT_CREATED,
            workflow_run: { id: "41", head_sha: OTHER_COMMIT },
          },
        ],
      },
    ],
  ])("rejects %s", async (_name, artifacts) => {
    const deps = harness(responses({ artifacts }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it.each([
    [
      "extra artifact key",
      {
        version: "vision.preview-normal-deploy-attribution/v1",
        outcome: "deployed",
        reviewedCommit: COMMIT,
        startedAt: DISPATCHED,
        completedAt: RUN_COMPLETED,
        provider: "private",
      },
    ],
    [
      "wrong artifact commit",
      {
        version: "vision.preview-normal-deploy-attribution/v1",
        outcome: "deployed",
        reviewedCommit: OTHER_COMMIT,
        startedAt: DISPATCHED,
        completedAt: RUN_COMPLETED,
      },
    ],
    [
      "wrong artifact outcome",
      {
        version: "vision.preview-normal-deploy-attribution/v1",
        outcome: "failed",
        reviewedCommit: COMMIT,
        startedAt: DISPATCHED,
        completedAt: RUN_COMPLETED,
      },
    ],
    [
      "artifact outside run interval",
      {
        version: "vision.preview-normal-deploy-attribution/v1",
        outcome: "deployed",
        reviewedCommit: COMMIT,
        startedAt: "2026-07-31T17:59:59.999Z",
        completedAt: RUN_COMPLETED,
      },
    ],
  ])("rejects %s", async (_name, attribution) => {
    const deps = harness(responses({ attribution }));
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("rejects attribution that starts before its containing run", async () => {
    const deps = harness(
      responses({
        attribution: {
          version: "vision.preview-normal-deploy-attribution/v1",
          outcome: "deployed",
          reviewedCommit: COMMIT,
          startedAt: "2026-07-31T18:00:00.499Z",
          completedAt: RUN_COMPLETED,
        },
      }),
    );
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("rejects noncanonical input and extra input keys before any call", async () => {
    for (const input of [
      { reviewedBranch: BRANCH, reviewedCommit: COMMIT.toUpperCase() },
      {
        reviewedBranch: BRANCH,
        reviewedCommit: COMMIT,
        remoteUrl: "private remote",
      },
    ]) {
      const deps = harness();
      await expect(
        runPreviewNormalDeploy(
          input as Parameters<typeof runPreviewNormalDeploy>[0],
          deps,
        ),
      ).rejects.toThrow(FAILURE);
      expect(deps.events).toEqual([]);
    }
  });

  it("maps child errors and hostile output to one constant failure", async () => {
    const fragments = [
      "https://example.invalid/private",
      "credential_secret_value",
      COMMIT,
      "provider response detail",
    ];
    for (const fragment of fragments) {
      const deps = harness([]);
      deps.runProviderCommand = vi.fn(async () => {
        throw new Error(fragment);
      });
      let observed = "";
      try {
        await runPreviewNormalDeploy(
          { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
          deps,
        );
      } catch (error) {
        observed = error instanceof Error ? error.message : String(error);
      }
      expect(observed).toBe(FAILURE);
      expect(observed).not.toContain(fragment);
    }

    const malformed = harness([
      { exitCode: 0, stdout: "private\nmultiline\n", stderr: "private" },
    ]);
    await expect(
      runPreviewNormalDeploy(
        { reviewedBranch: BRANCH, reviewedCommit: COMMIT },
        malformed,
      ),
    ).rejects.toThrow(FAILURE);
  });
});
