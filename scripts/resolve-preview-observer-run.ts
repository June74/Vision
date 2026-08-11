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
// Keep enough room for one or more slow GitHub metadata reads after the
// 120-second stable-listener window before the outer controller aborts.
const TERMINAL_POLL_SETTLEMENT_MILLISECONDS = 30_000;
const PROVIDER_TIMESTAMP_UNCERTAINTY_MILLISECONDS = 999;
const CONTEXT_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const PROVIDER_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const uniquenessClosesByDependencies = new WeakMap<
  PreviewObserverResolutionDependencies,
  Map<string, number>
>();
const providerUniquenessClosesByDependencies = new WeakMap<
  PreviewObserverResolutionDependencies,
  Map<string, number>
>();
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

/** Absolute monotonic deadline and cancellation signal for one provider call. */
export interface PreviewObserverCallContext {
  readonly deadlineMonotonic: number;
  readonly signal: AbortSignal;
}

/** Captured provider result; neither child stream may be forwarded. */
export interface PreviewObserverCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

/** Argument-array provider command boundary used by the concrete adapter. */
export type PreviewObserverCommandRunner = (
  executable: string,
  arguments_: readonly string[],
  context: PreviewObserverCallContext,
) => Promise<PreviewObserverCommandResult>;

/** Shared exact job-name contract used by workflow and validators. */
export const PREVIEW_OBSERVER_JOB_CONTRACT = Object.freeze({
  foundation_probe: Object.freeze(["Capture foundation_probe signal"]),
  preview_fault: Object.freeze(["Capture preview_fault signal"]),
  ai_usage: Object.freeze([
    "Capture ai_usage signal",
    "Capture ai_usage uniqueness",
  ]),
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
  sleep(
    milliseconds: number,
    context: PreviewObserverCallContext,
  ): Promise<void>;
  listRuns(
    page: number,
    context: PreviewObserverCallContext,
  ): Promise<unknown>;
  readRun(
    handle: PreviewObserverRunHandle,
    context: PreviewObserverCallContext,
  ): Promise<unknown>;
  listJobs(
    handle: PreviewObserverRunHandle,
    context: PreviewObserverCallContext,
  ): Promise<unknown>;
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
  outerContext?: PreviewObserverCallContext,
): Promise<PreviewObserverRunHandle> {
  validateResolutionInput(input);
  const started = validMonotonic(deps.monotonicNow());
  const deadline = boundedObserverDeadline(
    started + RESOLUTION_MILLISECONDS,
    deps,
    outerContext,
  );
  let candidate: PreviewObserverRunHandle | null = null;
  for (;;) {
    const pollStarted = validMonotonic(deps.monotonicNow());
    const pollDeadline = boundedObserverDeadline(
      pollStarted >= deadline
        ? deadline + TERMINAL_POLL_SETTLEMENT_MILLISECONDS
        : deadline,
      deps,
      outerContext,
    );
    const runs = (
      await listRelevantRuns(
        input.dispatchStartedAt,
        pollDeadline,
        deps,
        outerContext,
      )
    ).filter((run) => matchesRunIdentity(run, input));
    if (runs.length > 1) fail();
    if (runs.length === 1) {
      const handle = runs[0]!.id as PreviewObserverRunHandle;
      if (candidate !== null && candidate !== handle) fail();
      const detailed = snapshotRun(
        await callBeforeDeadline(
          pollDeadline,
          deps,
          (context) => deps.readRun(handle, context),
          outerContext,
        ),
      );
      if (
        detailed.id !== handle ||
        !matchesRunIdentity(detailed, input) ||
        !["queued", "in_progress"].includes(detailed.status) ||
        detailed.conclusion !== null
      ) {
        fail();
      }
      const jobs = await jobsFor(handle, deps, pollDeadline, outerContext);
      const topology = expectedJobTopology(jobs, input.family);
      if (topology === "active") {
        if (detailed.status !== "in_progress") fail();
        if (
          validMonotonic(deps.monotonicNow()) - started >=
            RESOLUTION_MILLISECONDS
        ) {
          return handle;
        }
      }
      candidate = handle;
    } else if (candidate !== null) {
      fail();
    }
    if (
      validMonotonic(deps.monotonicNow()) - started >=
        RESOLUTION_MILLISECONDS
    ) {
      fail();
    }
    await sleepBeforeDeadline(
      POLL_MILLISECONDS,
      deadline,
      deps,
      outerContext,
    );
  }
}

/** Lists every bounded page that could contain a dispatch-interval run. */
async function listRelevantRuns(
  dispatchStartedAt: Date,
  deadline: number,
  deps: PreviewObserverResolutionDependencies,
  outerContext?: PreviewObserverCallContext,
): Promise<readonly RunSnapshot[]> {
  const runs: RunSnapshot[] = [];
  let previousCreatedAt = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= MAX_RUN_PAGES; page += 1) {
    const pageRuns = snapshotRuns(
      await callBeforeDeadline(
        deadline,
        deps,
        (context) => deps.listRuns(page, context),
        outerContext,
      ),
    );
    let crossedDispatchStart = false;
    for (const run of pageRuns) {
      const createdAt = canonicalDate(run.createdAt).getTime();
      if (
        createdAt > previousCreatedAt
      ) {
        fail();
      }
      previousCreatedAt = createdAt;
      runs.push(run);
      if (createdAt + 999 < dispatchStartedAt.getTime()) {
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
  outerContext?: PreviewObserverCallContext,
): Promise<{
  readonly signal: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
}> {
  const jobs = await jobsFor(
    handle,
    deps,
    stateReadDeadline(deps, outerContext),
    outerContext,
  );
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
  outerContext?: PreviewObserverCallContext,
): Promise<{
  readonly signal: "listening" | "succeeded" | "failed";
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
  readonly uniquenessClosesAt: Date | null;
}> {
  const jobs = await jobsFor(
    handle,
    deps,
    stateReadDeadline(deps, outerContext),
    outerContext,
  );
  const providerReadAt = new Date(Date.now());
  if (!validDate(providerReadAt)) fail();
  const signal = observerJobState(exactJob(jobs, `Capture ${family} signal`));
  const uniqueness = observerJobState(
    exactJob(jobs, `Capture ${family} uniqueness`),
  );
  const signalObservedAt =
    signal.state === "succeeded"
      ? canonicalDate(signal.listener.completedAt)
      : null;
  const uniquenessCompletedAt =
    uniqueness.state === "succeeded"
      ? canonicalDate(uniqueness.listener.completedAt)
      : null;
  return Object.freeze({
    signal: signal.state,
    uniqueness: uniqueness.state,
    signalObservedAt,
    uniquenessClosesAt: conservativeUniquenessClose(
      handle,
      family,
      deps,
      signalObservedAt,
      uniquenessCompletedAt,
      providerReadAt,
    ),
  });
}

/** Reads the two AI jobs without exposing evidence or provider payloads. */
export async function readPreviewAiObserverState(
  handle: PreviewObserverRunHandle,
  deps: PreviewObserverResolutionDependencies,
  outerContext?: PreviewObserverCallContext,
): Promise<{
  readonly signal: "listening" | "succeeded" | "failed";
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
}> {
  const jobs = await jobsFor(
    handle,
    deps,
    stateReadDeadline(deps, outerContext),
    outerContext,
  );
  const signal = observerJobState(exactJob(jobs, "Capture ai_usage signal"));
  const uniqueness = observerJobState(
    exactJob(jobs, "Capture ai_usage uniqueness"),
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
  outerContext?: PreviewObserverCallContext,
): Promise<{
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly maintenanceScheduledAt: Date;
  readonly maintenanceCompletedAt: Date | null;
}> {
  if (!validDate(tick)) fail();
  const jobs = await jobsFor(
    handle,
    deps,
    stateReadDeadline(deps, outerContext),
    outerContext,
  );
  const state = observerJobState(
    exactJob(jobs, `Capture ${family} uniqueness`),
  );
  let maintenanceCompletedAt: Date | null = null;
  if (state.state === "succeeded") {
    const completedAt = canonicalDate(state.listener.completedAt);
    if (completedAt.getTime() !== tick.getTime() + RESOLUTION_MILLISECONDS) {
      fail();
    }
    maintenanceCompletedAt = completedAt;
  }
  return Object.freeze({
    uniqueness: state.state,
    maintenanceScheduledAt: new Date(tick.getTime()),
    maintenanceCompletedAt,
  });
}

/** Builds a privacy-safe argument-array GitHub adapter for one repository. */
export function createGitHubObserverResolutionDependencies(input: {
  readonly repository: string;
  readonly executable?: string;
  readonly monotonicNow?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly runCommand?: PreviewObserverCommandRunner;
}): PreviewObserverResolutionDependencies {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(input.repository)) fail();
  const executable = input.executable ?? "gh";
  const monotonicNow = input.monotonicNow ?? (() => performance.now());
  const runCommand =
    input.runCommand ??
    ((command, arguments_, context) =>
      runCapturedProviderCommand(
        command,
        arguments_,
        context,
        monotonicNow,
      ));
  /** Invokes one captured metadata command without a shell. */
  const invoke = async (
    arguments_: readonly string[],
    context: PreviewObserverCallContext,
    validateProjection: (payload: unknown) => void,
  ): Promise<unknown> => {
    try {
      const result = await raceCommandAgainstDeadline(
        (commandContext) =>
          runCommand(executable, [...arguments_], commandContext),
        context,
        monotonicNow,
      );
      if (
        typeof result?.stdout !== "string" ||
        typeof result.stderr !== "string" ||
        Buffer.byteLength(result.stdout, "utf8") > MAX_RESPONSE_BYTES ||
        Buffer.byteLength(result.stderr, "utf8") > MAX_RESPONSE_BYTES
      ) {
        fail();
      }
      const payload = JSON.parse(result.stdout) as unknown;
      validateProjection(payload);
      return payload;
    } catch {
      fail();
    }
  };
  const dependencies: PreviewObserverResolutionDependencies = {
    monotonicNow,
    sleep:
      input.sleep ??
      ((milliseconds: number, context: PreviewObserverCallContext) =>
        interruptibleSleep(milliseconds, context)),
    /** Lists bounded workflow-dispatch runs for resolution. */
    listRuns: (page, context) => {
      if (!Number.isSafeInteger(page) || page < 1 || page > MAX_RUN_PAGES) {
        fail();
      }
      return invoke([
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
      ], context, (payload) => {
        snapshotRuns(payload);
      });
    },
    /** Re-reads one selected run by its opaque handle. */
    readRun: (handle, context) => {
      const runRef = validatedRunHandle(handle);
      return invoke([
        "api",
        "-X",
        "GET",
        `repos/${input.repository}/actions/runs/${runRef}`,
        "--jq",
        "{id,event,head_sha,created_at,path,status,conclusion}",
      ], context, (payload) => {
        snapshotRun(payload);
      });
    },
    /** Lists bounded jobs for one selected observer run. */
    listJobs: (handle, context) => {
      const runRef = validatedRunHandle(handle);
      return invoke([
        "api",
        "-X",
        "GET",
        `repos/${input.repository}/actions/runs/${runRef}/jobs`,
        "-f",
        "per_page=100",
        "--jq",
        "{jobs: [.jobs[] | {name,status,conclusion,steps: [.steps[] | {name,status,conclusion,completed_at}]}]}",
      ], context, (payload) => {
        snapshotJobs(payload);
      });
    },
  };
  return Object.freeze(dependencies);
}

/** Returns bounded ordinary job snapshots for one in-memory handle. */
async function jobsFor(
  handle: PreviewObserverRunHandle,
  deps: PreviewObserverResolutionDependencies,
  deadline: number,
  outerContext?: PreviewObserverCallContext,
): Promise<readonly JobSnapshot[]> {
  return snapshotJobs(
    await callBeforeDeadline(
      deadline,
      deps,
      (context) => deps.listJobs(handle, context),
      outerContext,
    ),
  );
}

/** Runs one metadata call against the resolver's shared absolute deadline. */
async function callBeforeDeadline<T>(
  deadlineMonotonic: number,
  deps: PreviewObserverResolutionDependencies,
  operation: (context: PreviewObserverCallContext) => Promise<T>,
  outerContext?: PreviewObserverCallContext,
): Promise<T> {
  const deadline = boundedObserverDeadline(
    deadlineMonotonic,
    deps,
    outerContext,
  );
  const remaining = deadline - validMonotonic(deps.monotonicNow());
  if (remaining < 0) fail();
  const controller = new AbortController();
  const removeOuterAbort = linkOuterAbort(controller, outerContext);
  const context = Object.freeze({
    deadlineMonotonic: deadline,
    signal: controller.signal,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const operationResult = operation(context).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    );
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(1, remaining));
    const settled = await operationResult;
    if (
      !settled.ok ||
      timedOut ||
      outerContext?.signal.aborted === true ||
      (outerContext !== undefined &&
        validMonotonic(deps.monotonicNow()) > deadline)
    ) {
      fail();
    }
    return settled.value;
  } catch {
    throw new Error(FAILURE);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    removeOuterAbort();
    if (!controller.signal.aborted) controller.abort();
  }
}

/** Sleeps no later than the next poll while retaining the shared deadline. */
async function sleepBeforeDeadline(
  milliseconds: number,
  deadlineMonotonic: number,
  deps: PreviewObserverResolutionDependencies,
  outerContext?: PreviewObserverCallContext,
): Promise<void> {
  const deadline = boundedObserverDeadline(
    deadlineMonotonic,
    deps,
    outerContext,
  );
  const remaining = deadline - validMonotonic(deps.monotonicNow());
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds <= 0 ||
    remaining <= 0
  ) {
    fail();
  }
  const controller = new AbortController();
  const removeOuterAbort = linkOuterAbort(controller, outerContext);
  try {
    await deps.sleep(
      Math.min(milliseconds, remaining),
      Object.freeze({
        deadlineMonotonic: deadline,
        signal: controller.signal,
      }),
    );
    if (
      outerContext?.signal.aborted === true ||
      (outerContext !== undefined &&
        validMonotonic(deps.monotonicNow()) > deadline)
    ) {
      fail();
    }
  } catch {
    fail();
  } finally {
    removeOuterAbort();
    controller.abort();
  }
}

/** Gives one standalone observer-state read a bounded absolute deadline. */
function stateReadDeadline(
  deps: PreviewObserverResolutionDependencies,
  outerContext?: PreviewObserverCallContext,
): number {
  return boundedObserverDeadline(
    validMonotonic(deps.monotonicNow()) + RESOLUTION_MILLISECONDS,
    deps,
    outerContext,
  );
}

/** Caps an internal deadline at one caller-supplied boundary. */
function boundedObserverDeadline(
  internalDeadline: number,
  deps: PreviewObserverResolutionDependencies,
  outerContext?: PreviewObserverCallContext,
): number {
  const deadline = validMonotonic(internalDeadline);
  if (outerContext === undefined) return deadline;
  const outerDeadline = validMonotonic(outerContext.deadlineMonotonic);
  if (
    typeof outerContext.signal !== "object" ||
    outerContext.signal === null ||
    typeof outerContext.signal.aborted !== "boolean" ||
    typeof outerContext.signal.addEventListener !== "function" ||
    typeof outerContext.signal.removeEventListener !== "function" ||
    outerContext.signal.aborted
  ) {
    fail();
  }
  const now = validMonotonic(deps.monotonicNow());
  if (outerDeadline < now) fail();
  return Math.min(deadline, outerDeadline);
}

/** Links one optional caller abort to a fresh operation controller. */
function linkOuterAbort(
  controller: AbortController,
  outerContext?: PreviewObserverCallContext,
): () => void {
  if (outerContext === undefined) return () => undefined;
  /** Aborts one linked operation. */
  const abort = () => controller.abort();
  outerContext.signal.addEventListener("abort", abort, { once: true });
  if (outerContext.signal.aborted) abort();
  return () => outerContext.signal.removeEventListener("abort", abort);
}

/** Conservatively closes no earlier than provider timestamp evidence. */
function conservativeUniquenessClose(
  handle: PreviewObserverRunHandle,
  family: "sync_suppression" | "restore",
  deps: PreviewObserverResolutionDependencies,
  signalObservedAt: Date | null,
  uniquenessCompletedAt: Date | null,
  providerReadAt: Date,
): Date | null {
  if (!validDate(providerReadAt)) fail();
  let closesByObserver = uniquenessClosesByDependencies.get(deps);
  if (closesByObserver === undefined) {
    closesByObserver = new Map<string, number>();
    uniquenessClosesByDependencies.set(deps, closesByObserver);
  }
  const observerKey = `${handle}:${family}`;
  let closesAt = closesByObserver.get(observerKey) ?? null;
  if (signalObservedAt !== null) {
    if (!validDate(signalObservedAt)) fail();
    const signalWindowClosesAt =
      signalObservedAt.getTime() +
      RESOLUTION_MILLISECONDS +
      PROVIDER_TIMESTAMP_UNCERTAINTY_MILLISECONDS;
    closesAt =
      closesAt === null
        ? signalWindowClosesAt
        : Math.max(closesAt, signalWindowClosesAt);
  }
  if (uniquenessCompletedAt !== null) {
    if (
      !validDate(uniquenessCompletedAt) ||
      uniquenessCompletedAt.getTime() > providerReadAt.getTime()
    ) {
      fail();
    }
    const completedSecondEndsAt =
      uniquenessCompletedAt.getTime() +
      PROVIDER_TIMESTAMP_UNCERTAINTY_MILLISECONDS;
    let providerClosesByObserver =
      providerUniquenessClosesByDependencies.get(deps);
    if (providerClosesByObserver === undefined) {
      providerClosesByObserver = new Map<string, number>();
      providerUniquenessClosesByDependencies.set(deps, providerClosesByObserver);
    }
    const previousProviderClose = providerClosesByObserver.get(observerKey);
    if (
      previousProviderClose !== undefined &&
      completedSecondEndsAt < previousProviderClose
    ) {
      fail();
    }
    providerClosesByObserver.set(observerKey, completedSecondEndsAt);
    closesAt =
      closesAt === null
        ? completedSecondEndsAt
        : Math.max(closesAt, completedSecondEndsAt);
  }
  if (closesAt === null) return null;
  const conservativeClose = new Date(closesAt);
  if (!validDate(conservativeClose)) fail();
  closesByObserver.set(observerKey, closesAt);
  return conservativeClose;
}

/** Captures and bounds one real provider child until it has settled. */
async function runCapturedProviderCommand(
  executable: string,
  arguments_: readonly string[],
  context: PreviewObserverCallContext,
  monotonicNow: () => number,
): Promise<PreviewObserverCommandResult> {
  const remaining =
    validMonotonic(context.deadlineMonotonic) -
    validMonotonic(monotonicNow());
  if (remaining < 0 || context.signal.aborted) fail();
  const result = await execFileAsync(executable, [...arguments_], {
    encoding: "utf8",
    maxBuffer: MAX_RESPONSE_BYTES,
    windowsHide: true,
    signal: context.signal,
    timeout: Math.max(1, remaining),
    killSignal: "SIGTERM",
  });
  return Object.freeze({
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

/** Settles an injected command no later than its absolute deadline. */
async function raceCommandAgainstDeadline(
  runCommand: (
    context: PreviewObserverCallContext,
  ) => Promise<PreviewObserverCommandResult>,
  context: PreviewObserverCallContext,
  monotonicNow: () => number,
): Promise<PreviewObserverCommandResult> {
  const remaining =
    validMonotonic(context.deadlineMonotonic) -
    validMonotonic(monotonicNow());
  if (remaining < 0 || context.signal.aborted) fail();
  const controller = new AbortController();
  const removeOuterAbort = linkOuterAbort(controller, context);
  const commandContext = Object.freeze({
    deadlineMonotonic: context.deadlineMonotonic,
    signal: controller.signal,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const commandResult = runCommand(commandContext).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    );
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(1, remaining));
    const settled = await commandResult;
    if (!settled.ok || timedOut || context.signal.aborted) fail();
    return settled.value;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    removeOuterAbort();
    if (!controller.signal.aborted) controller.abort();
  }
}

/** Implements one sleep that rejects promptly when its caller aborts. */
function interruptibleSleep(
  milliseconds: number,
  context: PreviewObserverCallContext,
): Promise<void> {
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < 0 ||
    context.signal.aborted
  ) {
    return Promise.reject(new Error(FAILURE));
  }
  return new Promise<void>((resolvePromise, rejectPromise) => {
    let timer: ReturnType<typeof setTimeout>;
    /** Cancels the pending delay without retaining a provider failure. */
    const abort = () => {
      clearTimeout(timer);
      rejectPromise(new Error(FAILURE));
    };
    context.signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      context.signal.removeEventListener("abort", abort);
      resolvePromise();
    }, milliseconds);
  });
}

/** Revalidates the opaque decimal handle before command construction. */
function validatedRunHandle(handle: PreviewObserverRunHandle): string {
  if (typeof handle !== "string" || !/^[1-9][0-9]{0,19}$/u.test(handle)) {
    fail();
  }
  return handle;
}

/** Admits one finite nonnegative monotonic instant. */
function validMonotonic(value: number): number {
  if (!Number.isFinite(value) || value < 0) fail();
  return value;
}

/** Requires one exact job and rejects duplicate named jobs. */
function exactJob(
  jobs: readonly JobSnapshot[],
  name: string,
): JobSnapshot {
  const matching = jobs.filter(
    (job) =>
      job.name === name &&
      !(job.status === "completed" && job.conclusion === "skipped"),
  );
  if (matching.length !== 1) fail();
  return matching[0]!;
}

/** Distinguishes a valid starting topology from exact active listeners. */
function expectedJobTopology(
  jobs: readonly JobSnapshot[],
  family: PreviewObserverFamily,
): "pending" | "active" {
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
  let pending = false;
  for (const name of expected) {
    const named = jobs.filter((job) => job.name === name);
    const matching = named.filter(
      (job) =>
        !(job.status === "completed" && job.conclusion === "skipped"),
    );
    if (matching.length > 1) fail();
    if (matching.length === 0) {
      if (named.length > 0) fail();
      pending = true;
      continue;
    }
    const job = matching[0]!;
    const listeners = job.steps.filter((step) => step.name === LISTENER_STEP);
    if (listeners.length > 1 || job.conclusion !== null) fail();
    if (job.status === "queued") {
      if (
        listeners.length === 1 &&
        (listeners[0]!.conclusion !== null ||
          !["queued", "pending"].includes(listeners[0]!.status))
      ) {
        fail();
      }
      pending = true;
      continue;
    }
    if (job.status !== "in_progress") fail();
    if (listeners.length === 0) {
      pending = true;
      continue;
    }
    const listener = listeners[0]!;
    if (
      listener.conclusion !== null ||
      !["queued", "pending", "in_progress"].includes(listener.status)
    ) {
      fail();
    }
    if (listener.status !== "in_progress") pending = true;
  }
  return pending ? "pending" : "active";
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
    exactKeys(record, [
      "id",
      "event",
      "head_sha",
      "created_at",
      "path",
      "status",
      "conclusion",
    ]);
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
      !/^[1-9][0-9]{0,19}$/u.test(snapshot.id) ||
      !validDate(canonicalDate(snapshot.createdAt))
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
    exactKeys(record, ["jobs"]);
    const values = ownData(record, "jobs");
    if (!Array.isArray(values) || values.length > MAX_JOBS) fail();
    return values.map((value) => {
      const job = plainRecord(value);
      exactKeys(job, ["name", "status", "conclusion", "steps"]);
      const rawSteps = ownData(job, "steps");
      if (!Array.isArray(rawSteps) || rawSteps.length > MAX_STEPS) fail();
      const steps = rawSteps.map((stepValue) => {
        const step = plainRecord(stepValue);
        exactKeys(step, ["name", "status", "conclusion", "completed_at"]);
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

/** Matches immutable workflow identity and dispatch time, independent of state. */
function matchesRunIdentity(
  run: RunSnapshot,
  input: {
    readonly expectedWorkflow: string;
    readonly expectedCommit: string;
    readonly dispatchStartedAt: Date;
    readonly dispatchCompletedAt: Date;
  },
): boolean {
  const created = canonicalDate(run.createdAt).getTime();
  const createdBucketEndsAt = created + 999;
  return (
    run.event === "workflow_dispatch" &&
    run.headSha === input.expectedCommit &&
    run.path === input.expectedWorkflow &&
    createdBucketEndsAt >= input.dispatchStartedAt.getTime() &&
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

/** Requires one exact allowlisted key set. */
function exactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
): void {
  const keys = Object.keys(record);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(record, key))
  ) {
    fail();
  }
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

/** Parses one exact canonical millisecond context timestamp. */
function canonicalContextDate(value: unknown): Date {
  if (typeof value !== "string" || !CONTEXT_INSTANT_PATTERN.test(value)) {
    fail();
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
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
export function parsePreviewObserverRunArguments(arguments_: readonly string[]): {
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
    dispatchStartedAt: canonicalContextDate(values.get("--dispatch-started-at")),
    dispatchCompletedAt: canonicalContextDate(
      values.get("--dispatch-completed-at"),
    ),
    family,
    ...(maintenance === undefined
      ? {}
       : { maintenanceScheduledAt: canonicalContextDate(maintenance) }),
  };
  validateResolutionInput(result);
  return result;
}

/** Runs the real CLI path while keeping its identifier and failures private. */
export async function runPreviewObserverCli(
  arguments_: readonly string[],
  createDependencies: (
    input: ReturnType<typeof parsePreviewObserverRunArguments>,
  ) => PreviewObserverResolutionDependencies =
    (input) =>
      createGitHubObserverResolutionDependencies({
        repository: input.repository,
      }),
): Promise<0 | 1> {
  try {
    const input = parsePreviewObserverRunArguments(arguments_);
    await resolvePreviewObserverRun(
      input,
      createDependencies(input),
    );
    return 0;
  } catch {
    return 1;
  }
}

/** Resolves the observer while keeping its identifier process-local. */
async function main(): Promise<void> {
  process.exitCode = await runPreviewObserverCli(process.argv.slice(2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
