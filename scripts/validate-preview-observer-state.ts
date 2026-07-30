/** Validates that the exact preview evidence listener step is still active. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PREVIEW_OBSERVER_JOB_CONTRACT,
  type PreviewObserverFamily,
} from "./resolve-preview-observer-run";

const INVALID = "Preview observer state is invalid.";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const LISTENER_STEP = "Print only allowlisted acceptance evidence";
const EVIDENCE = new Set<PreviewObserverEvidence>(
  Object.keys(PREVIEW_OBSERVER_JOB_CONTRACT) as PreviewObserverEvidence[],
);

/** Evidence families with a dedicated preview listener job. */
export type PreviewObserverEvidence = PreviewObserverFamily;

/** Closed input needed to bind one workflow run to its exact active listener. */
export interface PreviewObserverState {
  readonly expectedSha: string;
  readonly evidence: PreviewObserverEvidence;
  readonly runResponse: unknown;
  readonly jobsResponse: unknown;
  readonly maintenanceScheduledAt?: string;
}

/** Rejects any run, job, or listener step that is not the exact active observer. */
export function validatePreviewObserverState(
  input: PreviewObserverState,
): void {
  const run = plainObject(input.runResponse);
  const jobsResponse = plainObject(input.jobsResponse);
  const jobs = Array.isArray(jobsResponse?.jobs)
    ? jobsResponse.jobs
    : [];
  const expectedJobNames = PREVIEW_OBSERVER_JOB_CONTRACT[input.evidence];

  if (
    !/^[a-f0-9]{40}$/u.test(input.expectedSha) ||
    !EVIDENCE.has(input.evidence) ||
    run?.event !== "workflow_dispatch" ||
    run.status !== "in_progress" ||
    run.conclusion !== null ||
    run.head_sha !== input.expectedSha ||
    !(
      run.path === ".github/workflows/preview.yml" ||
      (
        typeof run.path === "string" &&
        run.path.startsWith(".github/workflows/preview.yml@refs/")
      )
    ) ||
    (input.evidence === "calendar_maintenance" &&
      input.maintenanceScheduledAt !== undefined &&
      !isCanonicalInstant(input.maintenanceScheduledAt)) ||
    !expectedJobNames.every((name) => activeExactListener(jobs, name)) ||
    jobs.some((value) => {
      const job = plainObject(value);
      return (
        typeof job?.name === "string" &&
        job.name.startsWith("Capture ") &&
        !(expectedJobNames as readonly string[]).includes(job.name) &&
        !(
          job.status === "completed" &&
          job.conclusion === "skipped"
        )
      );
    })
  ) {
    throw new Error(INVALID);
  }
}

/** Requires one independently active job and one exact listener step. */
function activeExactListener(jobs: readonly unknown[], name: string): boolean {
  const matchingJobs = jobs
    .map(plainObject)
    .filter((job) => job?.name === name);
  if (matchingJobs.length !== 1) return false;
  const job = matchingJobs[0];
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const listeners = steps
    .map(plainObject)
    .filter((step) => step?.name === LISTENER_STEP);
  return (
    job?.status === "in_progress" &&
    job.conclusion === null &&
    listeners.length === 1 &&
    listeners[0]?.status === "in_progress" &&
    listeners[0].conclusion === null
  );
}

/** Recognizes one canonical millisecond UTC instant. */
function isCanonicalInstant(value: string): boolean {
  const parsed = Date.parse(value);
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === value
  );
}

/** Returns only ordinary data objects without invoking custom prototypes. */
function plainObject(value: unknown): Record<string, unknown> | undefined {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    ? value as Record<string, unknown>
    : undefined;
}

/** Reads one bounded JSON response captured by the workflow. */
async function readResponse(path: string): Promise<unknown> {
  const serialized = await readFile(resolve(path), "utf8");
  if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error(INVALID);
  }
  return JSON.parse(serialized);
}

/** Parses the closed four-flag command used by preview observer checks. */
function parseArguments(arguments_: readonly string[]): {
  readonly runFile: string;
  readonly jobsFile: string;
  readonly expectedSha: string;
  readonly evidence: PreviewObserverEvidence;
} {
  const expectedFlags = new Set([
    "--run-file",
    "--jobs-file",
    "--sha",
    "--evidence",
  ]);
  const parsed = new Map<string, string>();
  if (arguments_.length !== expectedFlags.size * 2) throw new Error(INVALID);
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (
      flag === undefined ||
      value === undefined ||
      !expectedFlags.has(flag) ||
      parsed.has(flag) ||
      value.length === 0
    ) {
      throw new Error(INVALID);
    }
    parsed.set(flag, value);
  }
  const evidence = parsed.get("--evidence");
  if (!EVIDENCE.has(evidence as PreviewObserverEvidence)) {
    throw new Error(INVALID);
  }
  return {
    runFile: parsed.get("--run-file") as string,
    jobsFile: parsed.get("--jobs-file") as string,
    expectedSha: parsed.get("--sha") as string,
    evidence: evidence as PreviewObserverEvidence,
  };
}

/** Validates captured responses without rendering provider data. */
async function main(): Promise<void> {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    const [runResponse, jobsResponse] = await Promise.all([
      readResponse(parsed.runFile),
      readResponse(parsed.jobsFile),
    ]);
    validatePreviewObserverState({
      expectedSha: parsed.expectedSha,
      evidence: parsed.evidence,
      runResponse,
      jobsResponse,
    });
    process.stdout.write("Preview observer state is valid.\n");
  } catch {
    process.stderr.write(`${INVALID}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
