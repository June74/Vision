/** Dispatches and verifies one permanent exact-commit normal preview deploy. */
import {
  runPrivacySafeGitRemote,
  type PrivacySafeGitRemoteDependencies,
} from "./privacy-safe-git-remote";

const FAILURE = "Preview normal deploy failed closed.";
const REVIEWED_BRANCH = "codex/phase-b-foundation";
const WORKFLOW = ".github/workflows/preview.yml";
const EVENT = "workflow_dispatch";
const JOB = "Deploy normal preview";
const ARTIFACT = "preview-normal-deploy-attribution-v1";
const ARTIFACT_VERSION = "vision.preview-normal-deploy-attribution/v1";
const MAX_CHILD_OUTPUT_BYTES = 65_536;
const MAX_DISPATCH_INTERVAL_MILLISECONDS = 60_000;
const MAX_TOTAL_MILLISECONDS = 10 * 60_000;

export interface PreviewNormalDeploySafeResult {
  readonly outcome: "deployed";
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface PreviewNormalDeployCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface PreviewNormalDeployDependencies {
  wallNow(): Date;
  monotonicNow(): number;
  readonly gitRemoteDependencies: PrivacySafeGitRemoteDependencies;
  runProviderCommand(
    arguments_: readonly string[],
  ): Promise<PreviewNormalDeployCommandResult>;
}

/** Runs the permanent normal deploy and returns timestamps plus outcome only. */
export async function runPreviewNormalDeploy(
  input: {
    readonly reviewedBranch: "codex/phase-b-foundation";
    readonly reviewedCommit: string;
  },
  dependencies: PreviewNormalDeployDependencies,
): Promise<PreviewNormalDeploySafeResult> {
  try {
    const admitted = readInput(input);
    const monotonicStartedAt = safeMonotonic(dependencies.monotonicNow());
    const startedAt = safeNow(dependencies.wallNow());

    await runPrivacySafeGitRemote(
      {
        operation: "assert_tip",
        reviewedBranch: REVIEWED_BRANCH,
        expectedCommit: admitted.reviewedCommit,
      },
      dependencies.gitRemoteDependencies,
    );

    const dispatch = exactRecord(
      await invokeProvider(dependencies, [
        "dispatch",
        WORKFLOW,
        REVIEWED_BRANCH,
        `reviewed_preview_commit=${admitted.reviewedCommit}`,
      ]),
      ["dispatched"],
    );
    if (ownData(dispatch, "dispatched") !== true) fail();
    const dispatchCompletedAt = safeNow(dependencies.wallNow());
    const dispatchElapsed =
      dispatchCompletedAt.getTime() - startedAt.getTime();
    if (
      dispatchElapsed < 0 ||
      dispatchElapsed > MAX_DISPATCH_INTERVAL_MILLISECONDS
    ) {
      fail();
    }

    const listed = exactRecord(
      await invokeProvider(dependencies, [
        "list-runs",
        WORKFLOW,
        EVENT,
        REVIEWED_BRANCH,
        startedAt.toISOString(),
        dispatchCompletedAt.toISOString(),
      ]),
      ["complete", "workflow_runs"],
    );
    if (ownData(listed, "complete") !== true) fail();
    const workflowRuns = ownData(listed, "workflow_runs");
    if (!Array.isArray(workflowRuns)) fail();
    const boundedRuns = workflowRuns
      .map(readRun)
      .filter((run) => {
        const createdAt = canonicalTimestamp(run.createdAt).getTime();
        return (
          createdAt >= startedAt.getTime() &&
          createdAt <= dispatchCompletedAt.getTime()
        );
      });
    if (boundedRuns.length !== 1) fail();
    const candidate = boundedRuns[0]!;
    assertRunAttribution(candidate, admitted.reviewedCommit);
    const runCreatedAt = canonicalTimestamp(candidate.createdAt);

    const resolved = readRun(
      await invokeProvider(dependencies, ["read-run", candidate.id]),
    );
    assertRunAttribution(resolved, admitted.reviewedCommit);
    if (!sameRun(candidate, resolved)) fail();
    if (resolved.status !== "completed" || resolved.conclusion !== "success") {
      fail();
    }
    const runCompletedAt = canonicalTimestamp(resolved.updatedAt);
    if (runCompletedAt.getTime() < runCreatedAt.getTime()) fail();

    const jobsRecord = exactRecord(
      await invokeProvider(dependencies, ["list-jobs", candidate.id]),
      ["total_count", "jobs"],
    );
    const totalJobs = ownData(jobsRecord, "total_count");
    const jobs = ownData(jobsRecord, "jobs");
    if (totalJobs !== 1 || !Array.isArray(jobs) || jobs.length !== 1) fail();
    const job = readJob(jobs[0]);
    if (
      job.name !== JOB ||
      job.status !== "completed" ||
      job.conclusion !== "success"
    ) {
      fail();
    }
    const jobStartedAt = canonicalTimestamp(job.startedAt);
    const jobCompletedAt = canonicalTimestamp(job.completedAt);
    if (
      jobStartedAt.getTime() < runCreatedAt.getTime() ||
      jobCompletedAt.getTime() < jobStartedAt.getTime() ||
      jobCompletedAt.getTime() > runCompletedAt.getTime()
    ) {
      fail();
    }

    const artifactRecord = exactRecord(
      await invokeProvider(dependencies, [
        "list-artifacts",
        candidate.id,
        ARTIFACT,
      ]),
      ["total_count", "artifacts"],
    );
    const totalArtifacts = ownData(artifactRecord, "total_count");
    const artifacts = ownData(artifactRecord, "artifacts");
    if (
      totalArtifacts !== 1 ||
      !Array.isArray(artifacts) ||
      artifacts.length !== 1
    ) {
      fail();
    }
    const artifact = readArtifact(artifacts[0]);
    if (
      artifact.name !== ARTIFACT ||
      artifact.expired !== false ||
      artifact.runId !== candidate.id ||
      artifact.headCommit !== admitted.reviewedCommit
    ) {
      fail();
    }
    const artifactCreatedAt = canonicalTimestamp(artifact.createdAt);
    if (artifactCreatedAt.getTime() < dispatchCompletedAt.getTime()) fail();

    const attribution = readAttribution(
      await invokeProvider(dependencies, ["read-artifact", artifact.id]),
    );
    if (
      attribution.version !== ARTIFACT_VERSION ||
      attribution.outcome !== "deployed" ||
      attribution.reviewedCommit !== admitted.reviewedCommit
    ) {
      fail();
    }
    const attributedStartedAt = canonicalTimestamp(attribution.startedAt);
    const attributedCompletedAt = canonicalTimestamp(attribution.completedAt);
    if (
      attributedStartedAt.getTime() < runCreatedAt.getTime() ||
      attributedCompletedAt.getTime() < attributedStartedAt.getTime() ||
      attributedCompletedAt.getTime() > runCompletedAt.getTime()
    ) {
      fail();
    }

    const completedAt = safeNow(dependencies.wallNow());
    const monotonicCompletedAt = safeMonotonic(dependencies.monotonicNow());
    if (
      completedAt.getTime() < artifactCreatedAt.getTime() ||
      completedAt.getTime() < runCompletedAt.getTime() ||
      monotonicCompletedAt < monotonicStartedAt ||
      monotonicCompletedAt - monotonicStartedAt > MAX_TOTAL_MILLISECONDS
    ) {
      fail();
    }

    return Object.freeze({
      outcome: "deployed",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
  } catch {
    fail();
  }
}

/** Invokes one provider operation by argument array and parses one JSON line. */
async function invokeProvider(
  dependencies: PreviewNormalDeployDependencies,
  arguments_: readonly string[],
): Promise<unknown> {
  let result: PreviewNormalDeployCommandResult;
  try {
    result = await dependencies.runProviderCommand(
      Object.freeze([...arguments_]),
    );
  } catch {
    fail();
  }
  const record = exactRecord(result, ["exitCode", "stdout", "stderr"]);
  const exitCode = ownData(record, "exitCode");
  const stdout = ownData(record, "stdout");
  const stderr = ownData(record, "stderr");
  if (
    exitCode !== 0 ||
    typeof stdout !== "string" ||
    typeof stderr !== "string" ||
    Buffer.byteLength(stdout, "utf8") > MAX_CHILD_OUTPUT_BYTES ||
    Buffer.byteLength(stderr, "utf8") > MAX_CHILD_OUTPUT_BYTES ||
    !/^\{[^\r\n]*\}\r?\n?$/u.test(stdout)
  ) {
    fail();
  }
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    fail();
  }
}

/** Snapshots the exact allowlisted branch and canonical commit input. */
function readInput(input: {
  readonly reviewedBranch: "codex/phase-b-foundation";
  readonly reviewedCommit: string;
}): { readonly reviewedBranch: "codex/phase-b-foundation"; readonly reviewedCommit: string } {
  const record = exactRecord(input, ["reviewedBranch", "reviewedCommit"]);
  const reviewedBranch = ownData(record, "reviewedBranch");
  const reviewedCommit = ownData(record, "reviewedCommit");
  if (reviewedBranch !== REVIEWED_BRANCH || !canonicalCommit(reviewedCommit)) {
    fail();
  }
  return Object.freeze({ reviewedBranch, reviewedCommit });
}

interface SafeRun {
  readonly id: string;
  readonly path: string;
  readonly event: string;
  readonly headCommit: string;
  readonly status: string;
  readonly conclusion: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Snapshots one exact provider run without exposing its handle. */
function readRun(value: unknown): SafeRun {
  const record = exactRecord(value, [
    "id",
    "path",
    "event",
    "head_sha",
    "status",
    "conclusion",
    "created_at",
    "updated_at",
  ]);
  const id = ownData(record, "id");
  const path = ownData(record, "path");
  const event = ownData(record, "event");
  const headCommit = ownData(record, "head_sha");
  const status = ownData(record, "status");
  const conclusion = ownData(record, "conclusion");
  const createdAt = ownData(record, "created_at");
  const updatedAt = ownData(record, "updated_at");
  if (
    typeof id !== "string" ||
    !/^[1-9][0-9]*$/u.test(id) ||
    typeof path !== "string" ||
    typeof event !== "string" ||
    !canonicalCommit(headCommit) ||
    typeof status !== "string" ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string"
  ) {
    fail();
  }
  canonicalTimestamp(createdAt);
  canonicalTimestamp(updatedAt);
  return Object.freeze({
    id,
    path,
    event,
    headCommit,
    status,
    conclusion,
    createdAt,
    updatedAt,
  });
}

/** Requires fixed workflow, event, and immutable commit attribution. */
function assertRunAttribution(run: SafeRun, commit: string): void {
  if (run.path !== WORKFLOW || run.event !== EVENT || run.headCommit !== commit) {
    fail();
  }
}

/** Binds a resolved run back to its unique listed identity. */
function sameRun(left: SafeRun, right: SafeRun): boolean {
  return (
    left.id === right.id &&
    left.path === right.path &&
    left.event === right.event &&
    left.headCommit === right.headCommit &&
    left.createdAt === right.createdAt
  );
}

interface SafeJob {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

/** Snapshots the exact safe containing-job fields. */
function readJob(value: unknown): SafeJob {
  const record = exactRecord(value, [
    "name",
    "status",
    "conclusion",
    "started_at",
    "completed_at",
  ]);
  const name = ownData(record, "name");
  const status = ownData(record, "status");
  const conclusion = ownData(record, "conclusion");
  const startedAt = ownData(record, "started_at");
  const completedAt = ownData(record, "completed_at");
  if (
    typeof name !== "string" ||
    typeof status !== "string" ||
    typeof conclusion !== "string" ||
    typeof startedAt !== "string" ||
    typeof completedAt !== "string"
  ) {
    fail();
  }
  return Object.freeze({ name, status, conclusion, startedAt, completedAt });
}

interface SafeArtifact {
  readonly id: string;
  readonly name: string;
  readonly expired: boolean;
  readonly createdAt: string;
  readonly runId: string;
  readonly headCommit: string;
}

/** Snapshots one artifact's fixed metadata and run binding. */
function readArtifact(value: unknown): SafeArtifact {
  const record = exactRecord(value, [
    "id",
    "name",
    "expired",
    "created_at",
    "workflow_run",
  ]);
  const id = ownData(record, "id");
  const name = ownData(record, "name");
  const expired = ownData(record, "expired");
  const createdAt = ownData(record, "created_at");
  const workflowRun = exactRecord(ownData(record, "workflow_run"), [
    "id",
    "head_sha",
  ]);
  const runId = ownData(workflowRun, "id");
  const headCommit = ownData(workflowRun, "head_sha");
  if (
    typeof id !== "string" ||
    !/^[1-9][0-9]*$/u.test(id) ||
    typeof name !== "string" ||
    typeof expired !== "boolean" ||
    typeof createdAt !== "string" ||
    typeof runId !== "string" ||
    !canonicalCommit(headCommit)
  ) {
    fail();
  }
  canonicalTimestamp(createdAt);
  return Object.freeze({ id, name, expired, createdAt, runId, headCommit });
}

interface SafeAttribution {
  readonly version: string;
  readonly outcome: string;
  readonly reviewedCommit: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

/** Snapshots the exact five-field normal-deploy attribution. */
function readAttribution(value: unknown): SafeAttribution {
  const record = exactRecord(value, [
    "version",
    "outcome",
    "reviewedCommit",
    "startedAt",
    "completedAt",
  ]);
  const version = ownData(record, "version");
  const outcome = ownData(record, "outcome");
  const reviewedCommit = ownData(record, "reviewedCommit");
  const startedAt = ownData(record, "startedAt");
  const completedAt = ownData(record, "completedAt");
  if (
    typeof version !== "string" ||
    typeof outcome !== "string" ||
    !canonicalCommit(reviewedCommit) ||
    typeof startedAt !== "string" ||
    typeof completedAt !== "string"
  ) {
    fail();
  }
  return Object.freeze({
    version,
    outcome,
    reviewedCommit,
    startedAt,
    completedAt,
  });
}

/** Requires a plain exact-key record with own enumerable data properties. */
function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  const record = value as Record<string, unknown>;
  const expected = [...keys].sort();
  const actual = Object.keys(record).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail();
  }
  for (const key of actual) ownData(record, key);
  return record;
}

/** Reads an own enumerable data property without invoking accessors. */
function ownData(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (
    descriptor === undefined ||
    !descriptor.enumerable ||
    !("value" in descriptor)
  ) {
    fail();
  }
  return descriptor.value;
}

/** Recognizes one canonical lowercase reviewed commit. */
function canonicalCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
}

/** Parses one millisecond-precision canonical UTC timestamp. */
function canonicalTimestamp(value: string): Date {
  const parsed = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    fail();
  }
  return parsed;
}

/** Validates and defensively copies one wall-clock sample. */
function safeNow(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail();
  return canonicalTimestamp(value.toISOString());
}

/** Accepts one finite nonnegative monotonic sample. */
function safeMonotonic(value: number): number {
  if (!Number.isFinite(value) || value < 0) fail();
  return value;
}

/** Throws the sole value-free normal-deploy failure. */
function fail(): never {
  throw new Error(FAILURE);
}
