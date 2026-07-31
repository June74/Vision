/** Resolves and reads one bounded current-workflow observer run. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FAILURE = "Preview observer metadata is invalid.";
const LISTENER_STEP = "Print only allowlisted acceptance evidence";
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_RUNS = 100;
const MAX_RUN_PAGES = 10;
const MAX_JOBS = 100;
const MAX_STEPS = 100;
const POLL_MILLISECONDS = 5_000;
const RESOLUTION_MILLISECONDS = 120_000;
const PROVIDER_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const execFileAsync = promisify(execFile);

export type PreviewObserverRunHandle = string & {
  readonly __observer: unique symbol;
};
export type PreviewObserverFamily =
  | "foundation_probe"
  | "preview_fault"
  | "ai_usage"
  | "sync_suppression"
  | "role_probe"
  | "restore"
  | "calendar_maintenance";

/** Shared exact job-name contract used by workflow and validators. */
export const PREVIEW_OBSERVER_JOB_CONTRACT = Object.freeze({
  foundation_probe: Object.freeze(["Capture foundation_probe signal"]),
  preview_fault: Object.freeze(["Capture preview_fault signal"]),
  ai_usage: Object.freeze(["Capture ai_usage signal"]),
  sync_suppression: Object.freeze([
    "Capture sync_suppression signal",
    "Capture sync_suppression uniqueness",
  ]),
  role_probe: Object.freeze(["Capture role_probe signal"]),
  restore: Object.freeze([
    "Capture restore signal",
    "Capture restore uniqueness",
  ]),
  calendar_maintenance: Object.freeze([
    "Capture calendar_maintenance uniqueness",
  ]),
} as const satisfies Readonly<
  Record<PreviewObserverFamily, readonly string[]>
>);

export interface PreviewObserverResolutionDependencies {
  monotonicNow(): number;
  sleep(milliseconds: number): Promise<void>;
  listRuns(page: number): Promise<unknown>;
  readRun(handle: PreviewObserverRunHandle): Promise<unknown>;
  listJobs(handle: PreviewObserverRunHandle): Promise<unknown>;
}

interface RunSnapshot {
  readonly id: string;
  readonly event: string;
  readonly headSha: string;
  readonly createdAt: string;
  readonly path: string;
  readonly status: string;
  readonly conclusion: string | null;
}
interface StepSnapshot {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly completedAt: string | null;
}
interface JobSnapshot {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly steps: readonly StepSnapshot[];
}

/** Resolves exactly one stable observer inside the dispatch interval. */
export async function resolvePreviewObserverRun(
  input: {
    readonly expectedWorkflow: string;
    readonly expectedCommit: string;
    readonly dispatchStartedAt: Date;
    readonly dispatchCompletedAt: Date;
    readonly family: PreviewObserverFamily;
    readonly maintenanceScheduledAt?: Date;
  },
  deps: PreviewObserverResolutionDependencies,
): Promise<PreviewObserverRunHandle> {
  validateResolutionInput(input);
  const started = deps.monotonicNow();
  let candidate: PreviewObserverRunHandle | null = null;
  for (;;) {
    const runs = (await listRelevantRuns(input.dispatchStartedAt, deps)).filter((run) =>
      matchesRun(run, input)
    );
    if (runs.length > 1) fail();
    if (runs.length === 1) {
      const handle = runs[0]!.id as PreviewObserverRunHandle;
      if (candidate !== null && candidate !== handle) fail();
      const detailed = snapshotRun(await deps.readRun(handle));
      if (detailed.id !== handle || !matchesRun(detailed, input)) fail();
      const jobs = await jobsFor(handle, deps);
      assertExpectedActiveJobs(jobs, input.family);
      if (deps.monotonicNow() - started >= RESOLUTION_MILLISECONDS) {
        return handle;
      }
      candidate = handle;
    } else if (candidate !== null) {
      fail();
    }
    if (deps.monotonicNow() - started >= RESOLUTION_MILLISECONDS) fail();
    await deps.sleep(POLL_MILLISECONDS);
  }
}

/** Lists every bounded page that could contain a dispatch-interval run. */
async function listRelevantRuns(
  dispatchStartedAt: Date,
  deps: PreviewObserverResolutionDependencies,
): Promise<readonly RunSnapshot[]> {
  const runs: RunSnapshot[] = [];
  let previousCreatedAt = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= MAX_RUN_PAGES; page += 1) {
    const pageRuns = snapshotRuns(await deps.listRuns(page));
    let crossedDispatchStart = false;
    for (const run of pageRuns) {
      const createdAt = Date.parse(run.createdAt);
      if (
        !Number.isFinite(createdAt) ||
        createdAt > previousCreatedAt
      ) {
        fail();
      }
      previousCreatedAt = createdAt;
      runs.push(run);
      if (createdAt < dispatchStartedAt.getTime()) {
        crossedDispatchStart = true;
      }
    }
    if (pageRuns.length < MAX_RUNS || crossedDispatchStart) {
      return Object.freeze(runs);
    }
  }
  fail();
}

/** Reads the fast signal job state. */
export async function readPreviewSignalObserverState(
  handle: PreviewObserverRunHandle,
  family: Exclude<PreviewObserverFamily, "calendar_maintenance">,
  deps: PreviewObserverResolutionDependencies,
): Promise<{
  readonly signal: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
}> {
  const jobs = await jobsFor(handle, deps);
  const job = exactJob(jobs, `Capture ${family} signal`);
  const state = observerJobState(job);
  return Object.freeze({
    signal: state.state,
    signalObservedAt:
      state.state === "succeeded"
        ? canonicalDate(state.listener.completedAt)
        : null,
  });
}

/** Reads separate signal and uniqueness jobs from one provider snapshot. */
export async function readPreviewTwoJobObserverState(
  handle: PreviewObserverRunHandle,
  family: "sync_suppression" | "restore",
  deps: PreviewObserverResolutionDependencies,
): Promise<{
  readonly signal: "listening" | "succeeded" | "failed";
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
}> {
  const jobs = await jobsFor(handle, deps);
  const signal = observerJobState(exactJob(jobs, `Capture ${family} signal`));
  const uniqueness = observerJobState(
    exactJob(jobs, `Capture ${family} uniqueness`),
  );
  return Object.freeze({
    signal: signal.state,
    uniqueness: uniqueness.state,
    signalObservedAt:
      signal.state === "succeeded"
        ? canonicalDate(signal.listener.completedAt)
        : null,
  });
}

/** Reads maintenance uniqueness bound to the caller's canonical tick. */
export async function readPreviewMaintenanceObserverState(
  handle: PreviewObserverRunHandle,
  family: "calendar_maintenance",
  tick: Date,
  deps: PreviewObserverResolutionDependencies,
): Promise<{
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly maintenanceScheduledAt: Date;
}> {
  if (!validDate(tick)) fail();
  const jobs = await jobsFor(handle, deps);
  const state = observerJobState(
    exactJob(jobs, `Capture ${family} uniqueness`),
  );
  if (state.state === "succeeded") {
    const completedAt = canonicalDate(state.listener.completedAt);
    if (
      completedAt.getTime() < tick.getTime() + RESOLUTION_MILLISECONDS ||
      completedAt.getTime() > tick.getTime() + 2 * RESOLUTION_MILLISECONDS
    ) {
      fail();
    }
  }
  return Object.freeze({
    uniqueness: state.state,
    maintenanceScheduledAt: new Date(tick.getTime()),
  });
}

/** Builds a privacy-safe argument-array GitHub adapter for one repository. */
export function createGitHubObserverResolutionDependencies(input: {
  readonly repository: string;
  readonly executable?: string;
  readonly monotonicNow?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}): PreviewObserverResolutionDependencies {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(input.repository)) fail();
  const executable = input.executable ?? "gh";
  /** Invokes one captured metadata command without a shell. */
  const invoke = async (arguments_: readonly string[]): Promise<unknown> => {
    try {
      const result = await execFileAsync(executable, [...arguments_], {
        encoding: "utf8",
        maxBuffer: MAX_RESPONSE_BYTES,
        windowsHide: true,
      });
      if (
        Buffer.byteLength(result.stdout, "utf8") > MAX_RESPONSE_BYTES ||
        result.stderr.length > MAX_RESPONSE_BYTES
      ) {
        fail();
      }
      return JSON.parse(result.stdout) as unknown;
    } catch {
      fail();
    }
  };
  const dependencies: PreviewObserverResolutionDependencies = {
    monotonicNow: input.monotonicNow ?? (() => performance.now()),
    sleep:
      input.sleep ??
      ((milliseconds: number) =>
        new Promise<void>((resolvePromise) =>
          setTimeout(resolvePromise, milliseconds)
        )),
    /** Lists bounded workflow-dispatch runs for resolution. */
    listRuns: (page) =>
      invoke([
        "api",
        "-X",
        "GET",
        `repos/${input.repository}/actions/runs`,
        "-f",
        "event=workflow_dispatch",
        "-f",
        "per_page=100",
        "-f",
        `page=${page}`,
        "--jq",
        "{workflow_runs: [.workflow_runs[] | {id,event,head_sha,created_at,path,status,conclusion}]}",
      ]),
    /** Re-reads one selected run by its opaque handle. */
    readRun: (handle) =>
      invoke([
        "api",
        "-X",
        "GET",
        `repos/${input.repository}/actions/runs/${handle}`,
      ]),
    /** Lists bounded jobs for one selected observer run. */
    listJobs: (handle) =>
      invoke([
        "api",
        "-X",
        "GET",
        `repos/${input.repository}/actions/runs/${handle}/jobs`,
        "-f",
        "per_page=100",
      ]),
  };
  return Object.freeze(dependencies);
}

/** Returns bounded ordinary job snapshots for one in-memory handle. */
async function jobsFor(
  handle: PreviewObserverRunHandle,
  deps: PreviewObserverResolutionDependencies,
): Promise<readonly JobSnapshot[]> {
  return snapshotJobs(await deps.listJobs(handle));
}

/** Requires one exact job and rejects duplicate named jobs. */
function exactJob(
  jobs: readonly JobSnapshot[],
  name: string,
): JobSnapshot {
  const matching = jobs.filter((job) => job.name === name);
  if (matching.length !== 1) fail();
  return matching[0]!;
}

/** Requires every family listener to be independently active. */
function assertExpectedActiveJobs(
  jobs: readonly JobSnapshot[],
  family: PreviewObserverFamily,
): void {
  const expected = PREVIEW_OBSERVER_JOB_CONTRACT[family];
  for (const job of jobs) {
    if (
      job.name.startsWith("Capture ") &&
      !expected.includes(job.name as never) &&
      !(
        job.status === "completed" &&
        job.conclusion === "skipped"
      )
    ) {
      fail();
    }
  }
  for (const name of expected) {
    const job = exactJob(jobs, name);
    const listener = exactListener(job);
    if (
      job.status !== "in_progress" ||
      job.conclusion !== null ||
      listener.status !== "in_progress" ||
      listener.conclusion !== null
    ) {
      fail();
    }
  }
}

/** Reduces a provider job/listener pair to a closed controller state. */
function observerJobState(job: JobSnapshot): {
  readonly state: "listening" | "succeeded" | "failed";
  readonly listener: StepSnapshot;
} {
  const listener = exactListener(job);
  if (
    job.status === "in_progress" &&
    job.conclusion === null &&
    listener.status === "in_progress" &&
    listener.conclusion === null
  ) {
    return { state: "listening", listener };
  }
  if (
    job.status === "completed" &&
    job.conclusion === "success" &&
    listener.status === "completed" &&
    listener.conclusion === "success"
  ) {
    if (listener.completedAt === null) fail();
    canonicalDate(listener.completedAt);
    return { state: "succeeded", listener };
  }
  if (
    job.status === "completed" ||
    listener.status === "completed"
  ) {
    return { state: "failed", listener };
  }
  fail();
}

/** Requires exactly one named listener among ordinary setup steps. */
function exactListener(job: JobSnapshot): StepSnapshot {
  const listeners = job.steps.filter((step) => step.name === LISTENER_STEP);
  if (listeners.length !== 1) fail();
  return listeners[0]!;
}

/** Snapshots a bounded run-list response without invoking accessors. */
function snapshotRuns(payload: unknown): readonly RunSnapshot[] {
  try {
    const record = plainRecord(payload);
    if (
      Object.keys(record).length !== 1 ||
      !Object.hasOwn(record, "workflow_runs")
    ) {
      fail();
    }
    const value = ownData(record, "workflow_runs");
    if (!Array.isArray(value) || value.length > MAX_RUNS) fail();
    return value.map(snapshotRun);
  } catch {
    fail();
  }
}

/** Snapshots one allowlisted run metadata record. */
function snapshotRun(value: unknown): RunSnapshot {
  try {
    const record = plainRecord(value);
    const id = ownData(record, "id");
    const snapshot = {
      id: String(id),
      event: boundedString(ownData(record, "event")),
      headSha: boundedString(ownData(record, "head_sha")),
      createdAt: boundedString(ownData(record, "created_at")),
      path: boundedString(ownData(record, "path")),
      status: boundedString(ownData(record, "status")),
      conclusion: nullableBoundedString(ownData(record, "conclusion")),
    };
    if (
      typeof id === "boolean" ||
      !/^[1-9][0-9]{0,19}$/u.test(snapshot.id)
    ) {
      fail();
    }
    return Object.freeze(snapshot);
  } catch {
    fail();
  }
}

/** Snapshots bounded provider jobs and setup/listener steps. */
function snapshotJobs(payload: unknown): readonly JobSnapshot[] {
  try {
    const record = plainRecord(payload);
    const values = ownData(record, "jobs");
    if (!Array.isArray(values) || values.length > MAX_JOBS) fail();
    return values.map((value) => {
      const job = plainRecord(value);
      const rawSteps = ownData(job, "steps");
      if (!Array.isArray(rawSteps) || rawSteps.length > MAX_STEPS) fail();
      const steps = rawSteps.map((stepValue) => {
        const step = plainRecord(stepValue);
        return Object.freeze({
          name: boundedString(ownData(step, "name")),
          status: boundedString(ownData(step, "status")),
          conclusion: nullableBoundedString(ownData(step, "conclusion")),
          completedAt: nullableBoundedString(
            optionalOwnData(step, "completed_at") ?? null,
          ),
        });
      });
      return Object.freeze({
        name: boundedString(ownData(job, "name")),
        status: boundedString(ownData(job, "status")),
        conclusion: nullableBoundedString(ownData(job, "conclusion")),
        steps: Object.freeze(steps),
      });
    });
  } catch {
    fail();
  }
}

/** Matches immutable workflow attribution and dispatch time. */
function matchesRun(
  run: RunSnapshot,
  input: {
    readonly expectedWorkflow: string;
    readonly expectedCommit: string;
    readonly dispatchStartedAt: Date;
    readonly dispatchCompletedAt: Date;
  },
): boolean {
  const created = Date.parse(run.createdAt);
  return (
    Number.isFinite(created) &&
    run.event === "workflow_dispatch" &&
    run.headSha === input.expectedCommit &&
    run.path === input.expectedWorkflow &&
    run.status === "in_progress" &&
    run.conclusion === null &&
    created >= input.dispatchStartedAt.getTime() &&
    created <= input.dispatchCompletedAt.getTime()
  );
}

/** Validates immutable resolver inputs before provider reads. */
function validateResolutionInput(input: {
  readonly expectedWorkflow: string;
  readonly expectedCommit: string;
  readonly dispatchStartedAt: Date;
  readonly dispatchCompletedAt: Date;
  readonly family: PreviewObserverFamily;
  readonly maintenanceScheduledAt?: Date;
}): void {
  if (
    input.expectedWorkflow !== ".github/workflows/preview.yml" ||
    !/^[a-f0-9]{40}$/u.test(input.expectedCommit) ||
    !validDate(input.dispatchStartedAt) ||
    !validDate(input.dispatchCompletedAt) ||
    input.dispatchCompletedAt.getTime() < input.dispatchStartedAt.getTime() ||
    !(input.family in PREVIEW_OBSERVER_JOB_CONTRACT) ||
    (input.family === "calendar_maintenance" &&
      !validDate(input.maintenanceScheduledAt))
  ) {
    fail();
  }
}

/** Returns one plain ordinary object and rejects inherited provider shapes. */
function plainRecord(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }
  return value as Record<string, unknown>;
}

/** Reads one required own data property without invoking accessors. */
function ownData(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    fail();
  }
  return descriptor.value;
}

/** Reads one optional own data property without invoking accessors. */
function optionalOwnData(
  record: Record<string, unknown>,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable) fail();
  return descriptor.value;
}

/** Admits one bounded provider string. */
function boundedString(value: unknown): string {
  if (typeof value !== "string" || value.length > 256) fail();
  return value;
}

/** Admits one bounded provider string or null. */
function nullableBoundedString(value: unknown): string | null {
  if (value === null) return null;
  return boundedString(value);
}

/** Parses one exact canonical provider-second timestamp. */
function canonicalDate(value: unknown): Date {
  if (typeof value !== "string" || !PROVIDER_INSTANT_PATTERN.test(value)) {
    fail();
  }
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value.replace("Z", ".000Z")
  ) {
    fail();
  }
  return new Date(parsed);
}

/** Recognizes one valid Date without coercion. */
function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** Throws the sole safe resolver error. */
function fail(): never {
  throw new Error(FAILURE);
}

/** Parses one strict live resolver command. */
function parseArguments(arguments_: readonly string[]): {
  readonly repository: string;
  readonly expectedWorkflow: string;
  readonly expectedCommit: string;
  readonly dispatchStartedAt: Date;
  readonly dispatchCompletedAt: Date;
  readonly family: PreviewObserverFamily;
  readonly maintenanceScheduledAt?: Date;
} {
  const flags = new Set([
    "--repository",
    "--workflow",
    "--sha",
    "--dispatch-started-at",
    "--dispatch-completed-at",
    "--family",
    "--maintenance-scheduled-at",
  ]);
  const values = new Map<string, string>();
  if (arguments_.length % 2 !== 0) fail();
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (
      !flag ||
      !value ||
      !flags.has(flag) ||
      values.has(flag)
    ) {
      fail();
    }
    values.set(flag, value);
  }
  const family = values.get("--family") as PreviewObserverFamily;
  const maintenance = values.get("--maintenance-scheduled-at");
  if (
    !family ||
    !(family in PREVIEW_OBSERVER_JOB_CONTRACT) ||
    values.size !== (family === "calendar_maintenance" ? 7 : 6)
  ) {
    fail();
  }
  const result = {
    repository: values.get("--repository") ?? "",
    expectedWorkflow: values.get("--workflow") ?? "",
    expectedCommit: values.get("--sha") ?? "",
    dispatchStartedAt: canonicalDate(values.get("--dispatch-started-at")),
    dispatchCompletedAt: canonicalDate(values.get("--dispatch-completed-at")),
    family,
    ...(maintenance === undefined
      ? {}
      : { maintenanceScheduledAt: canonicalDate(maintenance) }),
  };
  validateResolutionInput(result);
  return result;
}

/** Resolves the observer while keeping its identifier process-local. */
async function main(): Promise<void> {
  try {
    const input = parseArguments(process.argv.slice(2));
    await resolvePreviewObserverRun(
      input,
      createGitHubObserverResolutionDependencies({
        repository: input.repository,
      }),
    );
  } catch {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
