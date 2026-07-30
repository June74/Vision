/** Resolves and reads bounded current-workflow observer metadata. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const FAILURE = "Preview observer metadata is invalid.";
export type PreviewObserverRunHandle = string & { readonly __observer: unique symbol };
export interface PreviewObserverResolutionDependencies {
  monotonicNow(): number;
  sleep(milliseconds: number): Promise<void>;
  listRuns(): Promise<unknown>;
  readRun(handle: PreviewObserverRunHandle): Promise<unknown>;
  listJobs(handle: PreviewObserverRunHandle): Promise<unknown>;
}
type Family = "foundation_probe" | "preview_fault" | "ai_usage" | "sync_suppression" | "role_probe" | "restore" | "calendar_maintenance";

/** Resolves one unambiguous observer inside the dispatch interval. */
export async function resolvePreviewObserverRun(input: {
  expectedWorkflow: string; expectedCommit: string; dispatchStartedAt: Date;
  dispatchCompletedAt: Date; family: Family; maintenanceScheduledAt?: Date;
}, deps: PreviewObserverResolutionDependencies): Promise<PreviewObserverRunHandle> {
  const started = deps.monotonicNow();
  for (;;) {
    const payload = await deps.listRuns() as { workflow_runs?: unknown[] };
    const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs.filter((value) => matchesRun(value, input)) : [];
    if (runs.length > 1) fail();
    if (runs.length === 1) {
      const handle = String((runs[0] as { id: unknown }).id) as PreviewObserverRunHandle;
      const jobs = await jobsFor(handle, deps);
      const expected = input.family === "calendar_maintenance"
        ? [`Capture ${input.family} uniqueness`]
        : input.family === "sync_suppression" || input.family === "restore"
          ? [`Capture ${input.family} signal`, `Capture ${input.family} uniqueness`]
          : [`Capture ${input.family} signal`];
      if (jobs.length !== expected.length || !expected.every((name) => jobs.some((job) => job.name === name))) fail();
      jobs.forEach(assertListener);
      return handle;
    }
    if (deps.monotonicNow() - started >= 120_000) fail();
    await deps.sleep(5_000);
  }
}

/** Reads the fast signal job state. */
export async function readPreviewSignalObserverState(handle: PreviewObserverRunHandle, family: Family, deps: PreviewObserverResolutionDependencies) {
  const job = (await jobsFor(handle, deps)).find((item) => item.name === `Capture ${family} signal`);
  if (!job) fail();
  assertListener(job as { steps: unknown[] });
  const step = job.steps[0] as Record<string, unknown>;
  const succeeded = job.status === "completed" && job.conclusion === "success" && step.status === "completed" && step.conclusion === "success";
  return Object.freeze({ signal: succeeded ? "succeeded" : "listening", signalObservedAt: succeeded ? canonicalDate(step.completed_at) : null });
}
/** Reads separate signal and uniqueness job states. */
export async function readPreviewTwoJobObserverState(handle: PreviewObserverRunHandle, family: "sync_suppression" | "restore", deps: PreviewObserverResolutionDependencies) {
  const signal = await readPreviewSignalObserverState(handle, family, deps);
  const unique = (await jobsFor(handle, deps)).find((item) => item.name === `Capture ${family} uniqueness`);
  if (!unique) fail();
  assertListener(unique);
  return Object.freeze({ ...signal, uniqueness: unique.status === "completed" && unique.conclusion === "success" ? "succeeded" : "listening" });
}
/** Reads uniqueness for one exact maintenance tick. */
export async function readPreviewMaintenanceObserverState(handle: PreviewObserverRunHandle, family: "calendar_maintenance", tick: Date, deps: PreviewObserverResolutionDependencies) {
  const job = (await jobsFor(handle, deps)).find((item) => item.name === `Capture ${family} uniqueness`) as Record<string, unknown> | undefined;
  if (!job) fail();
  assertListener(job as { steps: unknown[] });
  const scheduled = canonicalDate(job.maintenanceScheduledAt);
  const closed = canonicalDate(job.closedAt);
  if (scheduled.getTime() !== tick.getTime() || closed.getTime() !== tick.getTime() + 120_000 || job.status !== "completed" || job.conclusion !== "success") fail();
  return Object.freeze({ uniqueness: "succeeded", maintenanceScheduledAt: scheduled });
}
/** Returns the jobs for one in-memory observer handle. */
async function jobsFor(handle: PreviewObserverRunHandle, deps: PreviewObserverResolutionDependencies) {
  const payload = await deps.listJobs(handle) as { jobs?: unknown[] };
  if (!Array.isArray(payload.jobs)) fail();
  return payload.jobs.map((job) => job as { name: string; status: string; conclusion: string | null; steps: unknown[] } & Record<string, unknown>);
}
/** Matches immutable workflow attribution and dispatch time. */
function matchesRun(value: unknown, input: { expectedWorkflow: string; expectedCommit: string; dispatchStartedAt: Date; dispatchCompletedAt: Date }) {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  const created = typeof run.created_at === "string" ? Date.parse(run.created_at) : NaN;
  return typeof run.id !== "boolean" && /^[1-9][0-9]*$/u.test(String(run.id)) && run.event === "workflow_dispatch" && run.head_sha === input.expectedCommit && run.path === input.expectedWorkflow && run.status === "in_progress" && run.conclusion === null && created >= input.dispatchStartedAt.getTime() && created <= input.dispatchCompletedAt.getTime();
}
/** Requires one exact allowlisted listener step. */
function assertListener(job: { steps: unknown[] }) {
  if (!Array.isArray(job.steps) || job.steps.length !== 1 || (job.steps[0] as Record<string, unknown>).name !== "Print only allowlisted acceptance evidence") fail();
}
/** Parses an allowlisted provider timestamp. */
function canonicalDate(value: unknown): Date {
  if (typeof value !== "string") fail();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail();
  return new Date(parsed);
}
/** Throws the sole safe resolver error. */
function fail(): never { throw new Error(FAILURE); }

/** Validates one independently resolved current-workflow observer without output. */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 8 || args[0] !== "--run-file" ||
        args[2] !== "--jobs-file" || args[4] !== "--sha" ||
        args[6] !== "--evidence") fail();
    const [runResponse, jobsResponse] = await Promise.all([
      readFile(resolve(args[1]!), "utf8").then(JSON.parse),
      readFile(resolve(args[3]!), "utf8").then(JSON.parse),
    ]);
    const family = args[7] as Family;
    const run = runResponse as Record<string, unknown>;
    if (run.head_sha !== args[5] || run.event !== "workflow_dispatch" ||
        run.status !== "in_progress" || run.conclusion !== null) fail();
    const dependencies: PreviewObserverResolutionDependencies = {
      /** Uses a fixed clock because the run is already resolved. */
      monotonicNow: () => 0,
      /** Does not poll in captured-state mode. */
      sleep: async () => undefined,
      /** Supplies the already captured run list. */
      listRuns: async () => ({ workflow_runs: [runResponse] }),
      /** Supplies the already captured run. */
      readRun: async () => runResponse,
      /** Supplies the already captured jobs. */
      listJobs: async () => jobsResponse,
    };
    const handle = String(run.id) as PreviewObserverRunHandle;
    if (family === "sync_suppression" || family === "restore") {
      await readPreviewTwoJobObserverState(handle, family, dependencies);
    } else if (family === "calendar_maintenance") {
      fail();
    } else {
      await readPreviewSignalObserverState(handle, family, dependencies);
    }
  } catch {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main();
}
