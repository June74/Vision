/** Coordinates guarded preview acceptance with one process-local observer. */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
  serializePreviewAcceptanceContext,
  type PreviewAcceptanceContext,
  type PreviewAcceptanceOperation,
} from "./prepare-preview-acceptance-deploy-config";
import {
  createGitHubObserverResolutionDependencies,
  readPreviewMaintenanceObserverState,
  readPreviewSignalObserverState,
  readPreviewTwoJobObserverState,
  resolvePreviewObserverRun,
  type PreviewObserverResolutionDependencies,
  type PreviewObserverRunHandle,
} from "./resolve-preview-observer-run";
import type { PreviewObserverAcceptanceExpectation } from "./safe-tail-classifier";
import { assertSyncSuppressionMargin } from "./validate-preview-sync-acceptance";
import { TEMPORARY_PREVIEW_FAULT_SCENARIOS } from "../src/domain/operations/temporary-preview-fault";

const FAILURE = "Preview acceptance controller failed closed.";
const POLL_MILLISECONDS = 5_000;
const UNIQUENESS_MILLISECONDS = 120_000;
const LOCAL_SIGNAL_MILLISECONDS = 50_000;
const PROVIDER_SIGNAL_MILLISECONDS = 59_000;
const APPROVAL_MILLISECONDS = 60_000;
const EXPIRY_BUFFER_MILLISECONDS = 60_000;
const PRE_IDLE_MILLISECONDS = 180_000;
const MAX_CHILD_OUTPUT_BYTES = 65_536;
const MAX_DRIVER_INPUT_BYTES = 8_192;
const REVIEWED_BRANCH = "codex/phase-b-foundation";
const REVIEWED_BRANCH_REF = `refs/heads/${REVIEWED_BRANCH}`;
const execFileAsync = promisify(execFile);
const CONTROLLER_STATUSES = Object.freeze([
  "observer_ready",
  "candidate_dispatched",
  "candidate_signal_seen",
  "rollback_dispatched",
  "closure_verified",
  "failed_closed",
] as const);
const OBSERVER_STATES = Object.freeze([
  "listening",
  "succeeded",
  "failed",
] as const);

export type PreviewAcceptanceStatus =
  | "observer_ready"
  | "candidate_dispatched"
  | "candidate_signal_seen"
  | "rollback_dispatched"
  | "closure_verified"
  | "failed_closed";

export type PreviewAcceptanceFamily =
  | "foundation_probe"
  | "preview_fault"
  | "ai_usage"
  | "sync_suppression"
  | "role_probe"
  | "restore"
  | "calendar_maintenance";

export interface PreviewAcceptanceControllerDependencies {
  wallNow(): Date;
  monotonicNow(): number;
  sleep(milliseconds: number): Promise<void>;
  assertRemoteTip(commit: string): Promise<boolean>;
  dispatch(
    operation: PreviewAcceptanceOperation,
    serializedContext: string,
  ): Promise<{ readonly runRef: string }>;
  resolveObserver(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  readObserverState(handle: unknown): Promise<{
    readonly signal: "listening" | "succeeded" | "failed";
    readonly uniqueness: "listening" | "succeeded" | "failed";
    readonly signalObservedAt: Date | null;
  }>;
  verifyCandidateAttribution(input: {
    readonly runRef: string;
    readonly operation: PreviewAcceptanceOperation;
    readonly reviewedCommit: string;
  }): Promise<void>;
  admitRestore(input: {
    readonly priorCandidateRunRef: string;
    readonly rollbackClosureRunRef: string;
    readonly reviewedCommit: string;
  }): Promise<"verified">;
  requestApproval(input: PreviewAcceptanceApprovalInput): Promise<Date>;
  performAction(input: PreviewAcceptanceActionInput): Promise<Date>;
  verifyClosure(input: PreviewAcceptanceClosureInput): Promise<void>;
  writeStatus(status: PreviewAcceptanceStatus): void;
}

export interface PreviewAcceptanceControllerInput {
  readonly family: PreviewAcceptanceFamily;
  readonly reviewedCommit: string;
  readonly expiresAt: string;
  readonly expectation: PreviewObserverAcceptanceExpectation;
  readonly priorCandidateRunRef?: string;
  readonly rollbackClosureRunRef?: string;
}

export interface PreviewAcceptanceActionInput {
  readonly family: PreviewAcceptanceFamily;
  readonly operation: Exclude<
    PreviewAcceptanceOperation,
    "none" | "observe" | "rollback" | "close_rollback" | "verify_cleanup"
  >;
  readonly candidateRunRef: string;
  readonly reviewedCommit: string;
}

export interface PreviewAcceptanceApprovalInput
  extends PreviewAcceptanceActionInput {
  readonly expiresAt: string;
}

export interface PreviewAcceptanceClosureInput
  extends PreviewAcceptanceActionInput {
  readonly rollbackRunRef: string;
  readonly closureRunRef: string;
}

export interface PreviewControllerCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type PreviewControllerCommandRunner = (
  executable: string,
  arguments_: readonly string[],
) => Promise<PreviewControllerCommandResult>;

export type PreviewControllerObserverPort = Pick<
  PreviewAcceptanceControllerDependencies,
  "resolveObserver" | "readObserverState"
>;

/**
 * Creates the concrete, output-capturing process boundary used by the
 * executable controller. The driver protocol returns only fixed JSON shapes.
 */
export function createPreviewControllerSubprocessDependencies(input: {
  readonly driverExecutable: string;
  readonly driverPrefixArguments?: readonly string[];
  readonly gitExecutable?: string;
  readonly repository?: string;
  readonly observerPort?: PreviewControllerObserverPort;
  readonly observerDependencies?: PreviewObserverResolutionDependencies;
  readonly runCommand?: PreviewControllerCommandRunner;
  readonly wallNow?: () => Date;
  readonly monotonicNow?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly writeStatus?: (status: PreviewAcceptanceStatus) => void;
}): PreviewAcceptanceControllerDependencies {
  const driverExecutable = boundedCommandPart(input.driverExecutable);
  const driverPrefixArguments = Object.freeze(
    (input.driverPrefixArguments ?? []).map(boundedCommandPart),
  );
  const gitExecutable = boundedCommandPart(input.gitExecutable ?? "git");
  const runCommand = input.runCommand ?? runCapturedCommand;
  const observerPort =
    input.observerPort ??
    createInProcessObserverPort({
      repository: input.repository,
      dependencies: input.observerDependencies,
      monotonicNow: input.monotonicNow,
      sleep: input.sleep,
    });

  /** Runs one captured child command without forwarding its streams. */
  const invoke = async (
    executable: string,
    arguments_: readonly string[],
  ): Promise<PreviewControllerCommandResult> => {
    try {
      const result = await runCommand(executable, [...arguments_]);
      if (
        typeof result?.stdout !== "string" ||
        typeof result.stderr !== "string" ||
        Buffer.byteLength(result.stdout, "utf8") > MAX_CHILD_OUTPUT_BYTES ||
        Buffer.byteLength(result.stderr, "utf8") > MAX_CHILD_OUTPUT_BYTES
      ) {
        fail();
      }
      return Object.freeze({
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch {
      fail();
    }
  };

  /** Invokes one closed driver operation with bounded arguments. */
  const invokeDriver = async (
    command: string,
    arguments_: readonly string[] = [],
  ): Promise<unknown> => {
    const result = await invoke(driverExecutable, [
      ...driverPrefixArguments,
      boundedCommandPart(command),
      ...arguments_.map(boundedDriverArgument),
    ]);
    return parseDriverJsonLine(result.stdout);
  };

  /** Requires the driver's exact success acknowledgement. */
  const expectOk = async (
    command: string,
    arguments_: readonly string[] = [],
  ): Promise<void> => {
    const record = exactRecord(await invokeDriver(command, arguments_), ["ok"]);
    if (ownData(record, "ok") !== true) fail();
  };

  const dependencies: PreviewAcceptanceControllerDependencies = {
    wallNow: input.wallNow ?? (() => new Date()),
    monotonicNow: input.monotonicNow ?? (() => performance.now()),
    sleep:
      input.sleep ??
      ((milliseconds: number) =>
        new Promise<void>((resolvePromise) =>
          setTimeout(resolvePromise, milliseconds)
        )),
    /** Verifies the reviewed branch tip immediately before dispatch. */
    assertRemoteTip: async (commit) => {
      const expectedCommit = validCommit(commit);
      const result = await invoke(gitExecutable, [
        "ls-remote",
        "--heads",
        "origin",
        REVIEWED_BRANCH_REF,
      ]);
      const match =
        /^([a-f0-9]{40})\trefs\/heads\/codex\/phase-b-foundation\r?\n?$/u.exec(
          result.stdout,
        );
      if (match === null) fail();
      return match[1] === expectedCommit;
    },
    /** Dispatches one canonical operation/context pair. */
    dispatch: async (operation, serializedContext) => {
      const record = exactRecord(
        await invokeDriver("dispatch", [operation, serializedContext]),
        ["runRef"],
      );
      const runRef = ownData(record, "runRef");
      if (!validRunRef(runRef)) fail();
      return Object.freeze({ runRef });
    },
    /** Resolves one observer while retaining only its opaque handle. */
    resolveObserver: async (resolutionInput) => {
      try {
        return await observerPort.resolveObserver(resolutionInput);
      } catch {
        fail();
      }
    },
    /** Reads one closed observer-state response. */
    readObserverState: async (handle) => {
      try {
        const state = await observerPort.readObserverState(handle);
        return snapshotControllerObserverState(state);
      } catch {
        fail();
      }
    },
    /** Verifies the candidate run and commit attribution. */
    verifyCandidateAttribution: (attribution) =>
      expectOk("verify-candidate-attribution", [
        attribution.runRef,
        attribution.operation,
        attribution.reviewedCommit,
      ]),
    /** Privately re-admits the immediately preceding role-probe closure. */
    admitRestore: async (admission) => {
      const record = exactRecord(
        await invokeDriver("admit-restore", [
          serializeDriverInput(admission),
        ]),
        ["attestation"],
      );
      if (ownData(record, "attestation") !== "verified") fail();
      return "verified";
    },
    /** Requests approval and returns only its canonical instant. */
    requestApproval: async (action) =>
      readDriverDate(
        await invokeDriver("request-approval", [
          serializePreviewApprovalInput(action),
        ]),
      ),
    /** Performs one admitted action and returns its completion instant. */
    performAction: async (action) =>
      readDriverDate(
        await invokeDriver(isUserMediatedFamily(action.family)
          ? "perform-action"
          : "confirm-candidate-deployment", [
          serializePreviewActionInput(action),
        ]),
      ),
    /** Verifies the exact rollback-closure binding. */
    verifyClosure: (closure) =>
      expectOk("verify-closure", [serializePreviewClosureInput(closure)]),
    /** Writes only one admitted controller status. */
    writeStatus: (status) => {
      if (!isControllerStatus(status)) fail();
      (input.writeStatus ??
        ((value) => process.stdout.write(`${value}\n`)))(status);
    },
  };
  return Object.freeze(dependencies);
}

/** Executes observer, candidate, rollback, and uniqueness fail-closed. */
export async function runPreviewAcceptanceController(
  input: PreviewAcceptanceControllerInput,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  input = snapshotControllerInput(input);
  const reviewedCommit = validCommit(input.reviewedCommit);
  const expiresAt = canonicalDate(input.expiresAt);
  let candidateRunRef: string | null = null;
  let rollbackRunRef: string | null = null;
  let rollbackStarted = false;

  /** Serializes every dispatch through the canonical closed context. */
  const dispatch = async (
    context: PreviewAcceptanceContext,
    beforeDispatch?: () => void,
  ): Promise<{ readonly runRef: string }> => {
    if (!(await dependencies.assertRemoteTip(reviewedCommit))) fail();
    beforeDispatch?.();
    const result = await dependencies.dispatch(
      context.kind,
      serializePreviewAcceptanceContext(context),
    );
    if (!validRunRef(result?.runRef)) fail();
    return Object.freeze({ runRef: result.runRef });
  };

  /** Immediately restores and closes one attributed candidate. */
  const rollbackAndClose = async (signal?: {
    readonly detectedAtMonotonic: number;
    readonly providerObservedAt: Date;
  }): Promise<void> => {
    if (candidateRunRef === null || rollbackStarted) return;
    rollbackStarted = true;
    const rollbackOperation = candidateOperation(input.family);
    const rollback = await dispatch(
      {
        version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
        kind: "rollback",
        reviewedCommit,
        candidateRunRef,
      },
      signal === undefined
        ? undefined
        : () => assertRollbackDispatchDeadline(signal, dependencies),
    );
    rollbackRunRef = rollback.runRef;
    dependencies.writeStatus("rollback_dispatched");
    const closure = await dispatch({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "close_rollback",
      reviewedCommit,
      candidateRunRef,
      rollbackRunRef,
      authenticatedReadsGate: "verified",
    });
    await dependencies.verifyClosure({
      family: input.family,
      operation: rollbackOperation,
      candidateRunRef,
      rollbackRunRef,
      closureRunRef: closure.runRef,
      reviewedCommit,
    });
    dependencies.writeStatus("closure_verified");
  };

  try {
    const observerStartedAt = safeNow(dependencies.wallNow());
    const observerClosesAt =
      input.family === "calendar_maintenance"
        ? maintenanceObserverClosesAt(input.expectation)
        : undefined;
    const observeContext = createObserveContext(
      input,
      reviewedCommit,
    );
    await dispatch(observeContext);
    const observerCompletedAt = safeNow(dependencies.wallNow());
    const observer = await dependencies.resolveObserver({
      family: input.family,
      expectedCommit: reviewedCommit,
      dispatchStartedAt: observerStartedAt,
      dispatchCompletedAt: observerCompletedAt,
      expectation: input.expectation,
    });
    dependencies.writeStatus("observer_ready");

    if (input.family === "calendar_maintenance") {
      if (observerClosesAt === undefined) fail();
      await waitForMaintenanceUniqueness(
        observer,
        observerClosesAt,
        dependencies,
      );
      dependencies.writeStatus("closure_verified");
      return;
    }

    const operation = candidateOperation(input.family);
    const restoreAdmission =
      operation === "deploy_restore"
        ? await admitRestore(input, reviewedCommit, dependencies)
        : undefined;
    const candidate = await dispatch(createCandidateContext(
      input,
      operation,
      reviewedCommit,
      observerStartedAt,
      observerCompletedAt,
      restoreAdmission,
    ));
    const candidateDispatchReturnedAt = safeNow(dependencies.wallNow());
    candidateRunRef = candidate.runRef;
    await dependencies.verifyCandidateAttribution({
      runRef: candidateRunRef,
      operation,
      reviewedCommit,
    });
    dependencies.writeStatus("candidate_dispatched");

    const actionInput = Object.freeze({
      family: input.family,
      operation,
      candidateRunRef,
      reviewedCommit,
    });
    let actionCompletedAt: Date;
    if (isUserMediatedFamily(input.family)) {
      assertPreActionIdleDeadline(
        safeNow(dependencies.wallNow()),
        expiresAt,
      );
      if (input.family === "sync_suppression") {
        assertSyncSuppressionMargin(
          safeNow(dependencies.wallNow()),
          input.expiresAt,
          "before_approval",
        );
      }
      const approvedAt = safeNow(
        await dependencies.requestApproval({
          ...actionInput,
          expiresAt: input.expiresAt,
        }),
      );
      const beforeAction = safeNow(dependencies.wallNow());
      const approvalAge = beforeAction.getTime() - approvedAt.getTime();
      if (approvalAge < 0 || approvalAge > APPROVAL_MILLISECONDS) fail();
      assertPreActionIdleDeadline(beforeAction, expiresAt);
      if (input.family === "sync_suppression") {
        assertSyncSuppressionMargin(
          beforeAction,
          input.expiresAt,
          "before_edit",
        );
      }
      actionCompletedAt = safeNow(
        await dependencies.performAction(actionInput),
      );
      if (actionCompletedAt.getTime() < beforeAction.getTime()) fail();
    } else {
      actionCompletedAt = safeNow(
        await dependencies.performAction(actionInput),
      );
      if (
        actionCompletedAt.getTime() <
        candidateDispatchReturnedAt.getTime()
      ) {
        fail();
      }
    }
    const sampledWall = safeNow(dependencies.wallNow());
    const sampledMonotonic = safeMonotonic(dependencies.monotonicNow());
    if (actionCompletedAt.getTime() > sampledWall.getTime()) fail();
    const absoluteNoSignalDeadline = new Date(Math.min(
      actionCompletedAt.getTime() + UNIQUENESS_MILLISECONDS,
      expiresAt.getTime() - EXPIRY_BUFFER_MILLISECONDS,
    ));
    const remainingNoSignalMilliseconds =
      absoluteNoSignalDeadline.getTime() - sampledWall.getTime();
    if (remainingNoSignalMilliseconds < 0) fail();
    const noSignalDeadline =
      sampledMonotonic + remainingNoSignalMilliseconds;

    const signal = await waitForSignal(
      observer,
      actionCompletedAt,
      sampledMonotonic,
      noSignalDeadline,
      absoluteNoSignalDeadline,
      dependencies,
    );
    dependencies.writeStatus("candidate_signal_seen");
    await rollbackAndClose({
      detectedAtMonotonic: signal.detectedAtMonotonic,
      providerObservedAt: signal.providerObservedAt,
    });

    if (isTwoJobFamily(input.family)) {
      let state = signal.state;
      const uniquenessClosesAt = new Date(
        signal.providerObservedAt.getTime() + UNIQUENESS_MILLISECONDS,
      );
      while (state.uniqueness !== "succeeded") {
        if (
          state.uniqueness === "failed" ||
          safeNow(dependencies.wallNow()).getTime() >
            uniquenessClosesAt.getTime() + POLL_MILLISECONDS
        ) {
          fail();
        }
        await dependencies.sleep(POLL_MILLISECONDS);
        state = await dependencies.readObserverState(observer);
      }
    }
  } catch {
    if (candidateRunRef !== null && !rollbackStarted) {
      try {
        await rollbackAndClose();
      } catch {
        // The sole public failure below intentionally hides child/provider data.
      }
    }
    dependencies.writeStatus("failed_closed");
    throw new Error(FAILURE);
  }
}

/** Waits for a fast signal while enforcing local and provider timestamps. */
async function waitForSignal(
  observer: unknown,
  actionCompletedAt: Date,
  actionCompletedMonotonic: number,
  noSignalDeadline: number,
  absoluteNoSignalDeadline: Date,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<{
  readonly state: Awaited<ReturnType<
    PreviewAcceptanceControllerDependencies["readObserverState"]
  >>;
  readonly detectedAtMonotonic: number;
  readonly providerObservedAt: Date;
}> {
  for (;;) {
    const state = await dependencies.readObserverState(observer);
    const detectedAtWall = safeNow(dependencies.wallNow());
    const detectedAtMonotonic = safeMonotonic(
      dependencies.monotonicNow(),
    );
    if (
      detectedAtWall.getTime() > absoluteNoSignalDeadline.getTime() ||
      detectedAtMonotonic > noSignalDeadline
    ) {
      fail();
    }
    if (state.signal === "failed" || state.uniqueness === "failed") fail();
    if (state.signal === "succeeded") {
      const observedAt = safeNow(state.signalObservedAt);
      const providerElapsed =
        observedAt.getTime() - actionCompletedAt.getTime();
      if (
        detectedAtMonotonic < actionCompletedMonotonic ||
        providerElapsed < 0 ||
        observedAt.getTime() > absoluteNoSignalDeadline.getTime()
      ) {
        fail();
      }
      return Object.freeze({
        state,
        detectedAtMonotonic,
        providerObservedAt: observedAt,
      });
    }
    if (safeMonotonic(dependencies.monotonicNow()) >= noSignalDeadline) {
      fail();
    }
    const remaining =
      noSignalDeadline - safeMonotonic(dependencies.monotonicNow());
    if (remaining <= 0) fail();
    await dependencies.sleep(Math.min(POLL_MILLISECONDS, remaining));
  }
}

/** Requires an approved action to begin before the generic idle boundary. */
function assertPreActionIdleDeadline(now: Date, expiresAt: Date): void {
  if (now.getTime() >= expiresAt.getTime() - PRE_IDLE_MILLISECONDS) {
    fail();
  }
}

/** Rechecks both rollback clocks immediately before dispatch begins. */
function assertRollbackDispatchDeadline(
  signal: {
    readonly detectedAtMonotonic: number;
    readonly providerObservedAt: Date;
  },
  dependencies: PreviewAcceptanceControllerDependencies,
): void {
  const localElapsed =
    safeMonotonic(dependencies.monotonicNow()) -
    signal.detectedAtMonotonic;
  const providerElapsed =
    safeNow(dependencies.wallNow()).getTime() -
    signal.providerObservedAt.getTime();
  if (
    localElapsed < 0 ||
    localElapsed > LOCAL_SIGNAL_MILLISECONDS ||
    providerElapsed < 0 ||
    providerElapsed > PROVIDER_SIGNAL_MILLISECONDS
  ) {
    fail();
  }
}

/** Waits only for the already-running permanent maintenance observer. */
async function waitForMaintenanceUniqueness(
  observer: unknown,
  closesAt: Date,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  for (;;) {
    const state = await dependencies.readObserverState(observer);
    if (state.uniqueness === "succeeded") return;
    if (
      state.uniqueness === "failed" ||
      safeNow(dependencies.wallNow()).getTime() >
        closesAt.getTime() + POLL_MILLISECONDS
    ) {
      fail();
    }
    const remaining =
      closesAt.getTime() +
      POLL_MILLISECONDS -
      safeNow(dependencies.wallNow()).getTime();
    if (remaining <= 0) fail();
    await dependencies.sleep(Math.min(POLL_MILLISECONDS, remaining));
  }
}

/** Creates the exact observe context, including only the maintenance tick. */
function createObserveContext(
  input: PreviewAcceptanceControllerInput,
  reviewedCommit: string,
): PreviewAcceptanceContext {
  const expectedOutcome = input.expectation.kind;
  const base = {
    version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
    kind: "observe" as const,
    reviewedCommit,
    evidenceFamily: input.family,
    expectedOutcome,
  };
  if (input.expectation.kind === "fault_expected") {
    if (input.family !== "preview_fault") fail();
    return Object.freeze({
      ...base,
      evidenceFamily: "preview_fault",
      expectedOutcome: "fault_expected",
      faultScenario: input.expectation.scenario,
    });
  }
  if (
    input.expectation.kind === "maintenance_succeeded" ||
    input.expectation.kind === "maintenance_repair_reserved"
  ) {
    if (input.family !== "calendar_maintenance") {
      fail();
    }
    return Object.freeze({
      ...base,
      evidenceFamily: "calendar_maintenance",
      expectedOutcome: input.expectation.kind,
      maintenanceScheduledAt: input.expectation.maintenanceScheduledAt,
    });
  }
  const matching =
    (input.family === "foundation_probe" &&
      expectedOutcome === "foundation_succeeded") ||
    (input.family === "ai_usage" && expectedOutcome === "ai_succeeded") ||
    (input.family === "sync_suppression" &&
      expectedOutcome === "sync_suppressed") ||
    (input.family === "role_probe" &&
      expectedOutcome === "role_probe_succeeded") ||
    (input.family === "restore" && expectedOutcome === "restore_succeeded");
  if (!matching) fail();
  return Object.freeze(base) as PreviewAcceptanceContext;
}

/** Creates one exact candidate dispatch context. */
function createCandidateContext(
  input: PreviewAcceptanceControllerInput,
  operation: Exclude<
    PreviewAcceptanceOperation,
    "none" | "observe" | "rollback" | "close_rollback" | "verify_cleanup"
  >,
  reviewedCommit: string,
  observerStartedAt: Date,
  observerCompletedAt: Date,
  restoreAdmission: "verified" | undefined,
): PreviewAcceptanceContext {
  const base = {
    version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
    kind: operation,
    reviewedCommit,
    authenticatedReadsGate: "verified" as const,
    candidateRunRef: input.priorCandidateRunRef ?? "baseline",
    rollbackClosureRunRef: input.rollbackClosureRunRef ?? "baseline",
    observerDispatchStartedAt: observerStartedAt.toISOString(),
    observerDispatchCompletedAt: observerCompletedAt.toISOString(),
  };
  if (operation === "deploy_fault") {
    if (input.expectation.kind !== "fault_expected") fail();
    return Object.freeze({
      ...base,
      kind: "deploy_fault",
      faultScenario: input.expectation.scenario,
    });
  }
  if (operation === "deploy_restore") {
    if (restoreAdmission !== "verified") fail();
    return Object.freeze({
      ...base,
      kind: "deploy_restore",
      restoreAdmissionGate: "verified",
    });
  }
  return Object.freeze(base) as PreviewAcceptanceContext;
}

/** Derives restore admission from a fresh private role-probe closure check. */
async function admitRestore(
  input: PreviewAcceptanceControllerInput,
  reviewedCommit: string,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<"verified"> {
  if (
    !validRunRef(input.priorCandidateRunRef) ||
    !validRunRef(input.rollbackClosureRunRef)
  ) {
    fail();
  }
  const attestation = await dependencies.admitRestore({
    priorCandidateRunRef: input.priorCandidateRunRef,
    rollbackClosureRunRef: input.rollbackClosureRunRef,
    reviewedCommit,
  });
  if (attestation !== "verified") fail();
  return "verified";
}

/** Maps each non-maintenance family to one closed candidate operation. */
function candidateOperation(
  family: PreviewAcceptanceFamily,
): Exclude<
  PreviewAcceptanceOperation,
  "none" | "observe" | "rollback" | "close_rollback" | "verify_cleanup"
> {
  switch (family) {
    case "foundation_probe":
      return "deploy_foundation";
    case "preview_fault":
      return "deploy_fault";
    case "ai_usage":
      return "deploy_ai";
    case "sync_suppression":
      return "deploy_sync_suppression";
    case "role_probe":
      return "deploy_role_probe";
    case "restore":
      return "deploy_restore";
    case "calendar_maintenance":
      fail();
  }
}

/** Recognizes the two independent uniqueness families. */
function isTwoJobFamily(
  family: PreviewAcceptanceFamily,
): family is "sync_suppression" | "restore" {
  return family === "sync_suppression" || family === "restore";
}

/** Distinguishes approved user actions from scheduled candidate confirmation. */
function isUserMediatedFamily(
  family: PreviewAcceptanceFamily,
): family is "ai_usage" | "sync_suppression" {
  return family === "ai_usage" || family === "sync_suppression";
}

/** Admits one lowercase reviewed commit. */
function validCommit(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/u.test(value)) fail();
  return value;
}

/** Admits one decimal provider run reference. */
function validRunRef(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,19}$/u.test(value);
}

/** Admits one canonical instant. */
function canonicalDate(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    fail();
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail();
  }
  return new Date(parsed);
}

/** Copies one valid wall-clock Date without retaining caller state. */
function safeNow(value: Date | null): Date {
  try {
    if (value instanceof Date) {
      const milliseconds = Date.prototype.getTime.call(value);
      if (Number.isFinite(milliseconds)) return new Date(milliseconds);
    }
  } catch {
    // Fall through to the one fixed failure.
  }
  fail();
}

/** Admits one finite monotonic timestamp. */
function safeMonotonic(value: number): number {
  if (!Number.isFinite(value) || value < 0) fail();
  return value;
}

/** Keeps provider run identifiers in one in-process opaque observer port. */
function createInProcessObserverPort(input: {
  readonly repository?: string;
  readonly dependencies?: PreviewObserverResolutionDependencies;
  readonly monotonicNow?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}): PreviewControllerObserverPort {
  const dependencies =
    input.dependencies ??
    createGitHubObserverResolutionDependencies({
      repository: boundedRepository(input.repository),
      monotonicNow: input.monotonicNow,
      sleep: input.sleep,
    });
  const handles = new WeakMap<
    object,
    {
      readonly handle: PreviewObserverRunHandle;
      readonly family: PreviewAcceptanceFamily;
      readonly maintenanceScheduledAt: Date | null;
    }
  >();

  return Object.freeze({
    /** Resolves one provider observer inside the opaque in-process port. */
    resolveObserver: async (value) => {
      const resolution = snapshotObserverResolutionInput(value);
      const handle = await resolvePreviewObserverRun(
        {
          expectedWorkflow: ".github/workflows/preview.yml",
          expectedCommit: resolution.expectedCommit,
          dispatchStartedAt: resolution.dispatchStartedAt,
          dispatchCompletedAt: resolution.dispatchCompletedAt,
          family: resolution.family,
          ...(resolution.maintenanceScheduledAt === null
            ? {}
            : {
                maintenanceScheduledAt:
                  resolution.maintenanceScheduledAt,
              }),
        },
        dependencies,
      );
      const opaque = Object.freeze(Object.create(null)) as object;
      handles.set(
        opaque,
        Object.freeze({
          handle,
          family: resolution.family,
          maintenanceScheduledAt: resolution.maintenanceScheduledAt,
        }),
      );
      return opaque;
    },
    /** Reads one provider observer state without exposing its handle. */
    readObserverState: async (opaque) => {
      if (typeof opaque !== "object" || opaque === null) fail();
      const state = handles.get(opaque);
      if (state === undefined) fail();
      if (
        state.family === "sync_suppression" ||
        state.family === "restore"
      ) {
        return readPreviewTwoJobObserverState(
          state.handle,
          state.family,
          dependencies,
        );
      }
      if (state.family === "calendar_maintenance") {
        if (state.maintenanceScheduledAt === null) fail();
        const maintenance = await readPreviewMaintenanceObserverState(
          state.handle,
          state.family,
          state.maintenanceScheduledAt,
          dependencies,
        );
        return Object.freeze({
          signal: "listening" as const,
          uniqueness: maintenance.uniqueness,
          signalObservedAt: null,
        });
      }
      const signal = await readPreviewSignalObserverState(
        state.handle,
        state.family,
        dependencies,
      );
      return Object.freeze({
        ...signal,
        uniqueness: "succeeded" as const,
      });
    },
  });
}

/** Snapshots the exact controller-to-resolver call without serializing a handle. */
function snapshotObserverResolutionInput(
  value: Readonly<Record<string, unknown>>,
): {
  readonly family: PreviewAcceptanceFamily;
  readonly expectedCommit: string;
  readonly dispatchStartedAt: Date;
  readonly dispatchCompletedAt: Date;
  readonly maintenanceScheduledAt: Date | null;
} {
  const record = exactRecordWithOptional(
    value,
    [
      "dispatchCompletedAt",
      "dispatchStartedAt",
      "expectation",
      "expectedCommit",
      "family",
    ],
    [],
  );
  const family = ownData(record, "family");
  if (!isControllerFamily(family)) fail();
  const expectation = snapshotExpectation(
    ownData(record, "expectation"),
    family,
  );
  const dispatchStartedAt = safeNow(
    ownData(record, "dispatchStartedAt") as Date,
  );
  const dispatchCompletedAt = safeNow(
    ownData(record, "dispatchCompletedAt") as Date,
  );
  if (dispatchCompletedAt.getTime() < dispatchStartedAt.getTime()) {
    fail();
  }
  const maintenanceScheduledAt =
    expectation.kind === "maintenance_succeeded" ||
    expectation.kind === "maintenance_repair_reserved"
      ? canonicalDate(expectation.maintenanceScheduledAt)
      : null;
  if (
    family === "calendar_maintenance"
      ? maintenanceScheduledAt === null
      : maintenanceScheduledAt !== null
  ) {
    fail();
  }
  return Object.freeze({
    family,
    expectedCommit: validCommit(ownData(record, "expectedCommit")),
    dispatchStartedAt,
    dispatchCompletedAt,
    maintenanceScheduledAt,
  });
}

/** Snapshots a custom observer port result to the controller's closed shape. */
function snapshotControllerObserverState(value: unknown): {
  readonly signal: "listening" | "succeeded" | "failed";
  readonly uniqueness: "listening" | "succeeded" | "failed";
  readonly signalObservedAt: Date | null;
} {
  const record = exactRecord(value, [
    "signal",
    "signalObservedAt",
    "uniqueness",
  ]);
  const signal = ownData(record, "signal");
  const uniqueness = ownData(record, "uniqueness");
  const observed = ownData(record, "signalObservedAt");
  if (
    !isObserverState(signal) ||
    !isObserverState(uniqueness) ||
    (signal === "succeeded" && !(observed instanceof Date)) ||
    (signal !== "succeeded" && observed !== null)
  ) {
    fail();
  }
  return Object.freeze({
    signal,
    uniqueness,
    signalObservedAt: observed === null ? null : safeNow(observed as Date),
  });
}

/** Snapshots one untrusted controller input before any remote action. */
function snapshotControllerInput(
  value: PreviewAcceptanceControllerInput,
): PreviewAcceptanceControllerInput {
  const record = exactRecordWithOptional(
    value,
    ["expiresAt", "expectation", "family", "reviewedCommit"],
    [
      "priorCandidateRunRef",
      "rollbackClosureRunRef",
    ],
  );
  const family = ownData(record, "family");
  if (!isControllerFamily(family)) fail();
  const expectation = snapshotExpectation(
    ownData(record, "expectation"),
    family,
  );
  const priorCandidateRunRef = optionalOwnData(
    record,
    "priorCandidateRunRef",
  );
  const rollbackClosureRunRef = optionalOwnData(
    record,
    "rollbackClosureRunRef",
  );
  if (
    (priorCandidateRunRef !== undefined &&
      !validLifecycleRunRef(priorCandidateRunRef)) ||
    (rollbackClosureRunRef !== undefined &&
      !validLifecycleRunRef(rollbackClosureRunRef))
  ) {
    fail();
  }
  const expiresAt = canonicalDate(
    ownData(record, "expiresAt"),
  ).toISOString();
  return Object.freeze({
    family,
    reviewedCommit: validCommit(ownData(record, "reviewedCommit")),
    expiresAt,
    expectation,
    ...(priorCandidateRunRef === undefined
      ? {}
      : { priorCandidateRunRef }),
    ...(rollbackClosureRunRef === undefined
      ? {}
      : { rollbackClosureRunRef }),
  });
}

/** Reconstructs the one family-compatible expectation variant. */
function snapshotExpectation(
  value: unknown,
  family: PreviewAcceptanceFamily,
): PreviewObserverAcceptanceExpectation {
  const record = exactRecordWithOptional(
    value,
    ["kind"],
    ["maintenanceScheduledAt", "scenario"],
  );
  const kind = ownData(record, "kind");
  const scenario = optionalOwnData(record, "scenario");
  const maintenanceScheduledAt = optionalOwnData(
    record,
    "maintenanceScheduledAt",
  );
  const simpleMatches =
    (family === "foundation_probe" && kind === "foundation_succeeded") ||
    (family === "ai_usage" && kind === "ai_succeeded") ||
    (family === "sync_suppression" && kind === "sync_suppressed") ||
    (family === "role_probe" && kind === "role_probe_succeeded") ||
    (family === "restore" && kind === "restore_succeeded");
  if (
    simpleMatches &&
    scenario === undefined &&
    maintenanceScheduledAt === undefined
  ) {
    return Object.freeze({ kind }) as PreviewObserverAcceptanceExpectation;
  }
  if (
    family === "preview_fault" &&
    kind === "fault_expected" &&
    typeof scenario === "string" &&
    TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(scenario as never) &&
    maintenanceScheduledAt === undefined
  ) {
    return Object.freeze({
      kind: "fault_expected",
      scenario,
    }) as PreviewObserverAcceptanceExpectation;
  }
  if (
    family === "calendar_maintenance" &&
    (kind === "maintenance_succeeded" ||
      kind === "maintenance_repair_reserved") &&
    scenario === undefined
  ) {
    return Object.freeze({
      kind,
      maintenanceScheduledAt: canonicalDate(
        maintenanceScheduledAt,
      ).toISOString(),
    });
  }
  fail();
}

/** Derives the fixed maintenance observer close from its canonical tick. */
function maintenanceObserverClosesAt(
  expectation: PreviewObserverAcceptanceExpectation,
): Date {
  if (
    expectation.kind !== "maintenance_succeeded" &&
    expectation.kind !== "maintenance_repair_reserved"
  ) {
    fail();
  }
  return new Date(
    canonicalDate(expectation.maintenanceScheduledAt).getTime() +
      UNIQUENESS_MILLISECONDS,
  );
}

/** Serializes one exact approval command input. */
function serializePreviewApprovalInput(
  input: PreviewAcceptanceApprovalInput,
): string {
  canonicalDate(input.expiresAt);
  return serializeDriverInput({
    family: input.family,
    operation: input.operation,
    candidateRunRef: input.candidateRunRef,
    reviewedCommit: input.reviewedCommit,
    expiresAt: input.expiresAt,
  });
}

/** Serializes one exact action command input. */
function serializePreviewActionInput(
  input: PreviewAcceptanceActionInput,
): string {
  validateActionInput(input);
  return serializeDriverInput({
    family: input.family,
    operation: input.operation,
    candidateRunRef: input.candidateRunRef,
    reviewedCommit: input.reviewedCommit,
  });
}

/** Serializes one exact rollback-closure verification input. */
function serializePreviewClosureInput(
  input: PreviewAcceptanceClosureInput,
): string {
  validateActionInput(input);
  if (
    !validRunRef(input.rollbackRunRef) ||
    !validRunRef(input.closureRunRef)
  ) {
    fail();
  }
  return serializeDriverInput({
    reviewedCommit: input.reviewedCommit,
    family: input.family,
    operation: input.operation,
    candidateRunRef: input.candidateRunRef,
    rollbackRunRef: input.rollbackRunRef,
    closureRunRef: input.closureRunRef,
  });
}

/** Validates the closed fields shared by action commands. */
function validateActionInput(input: PreviewAcceptanceActionInput): void {
  if (
    !isControllerFamily(input.family) ||
    input.family === "calendar_maintenance" ||
    candidateOperation(input.family) !== input.operation ||
    !validRunRef(input.candidateRunRef) ||
    validCommit(input.reviewedCommit) !== input.reviewedCommit
  ) {
    fail();
  }
}

/** Captures child streams and never inherits or forwards them. */
async function runCapturedCommand(
  executable: string,
  arguments_: readonly string[],
): Promise<PreviewControllerCommandResult> {
  try {
    const result = await execFileAsync(executable, [...arguments_], {
      encoding: "utf8",
      maxBuffer: MAX_CHILD_OUTPUT_BYTES,
      windowsHide: true,
    });
    if (
      typeof result.stdout !== "string" ||
      typeof result.stderr !== "string"
    ) {
      fail();
    }
    return Object.freeze({
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch {
    fail();
  }
}

/** Parses one exact single-line JSON driver response. */
function parseDriverJsonLine(stdout: string): unknown {
  if (
    Buffer.byteLength(stdout, "utf8") > MAX_CHILD_OUTPUT_BYTES ||
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

/** Serializes only bounded ordinary data values for one driver argument. */
function serializeDriverInput(value: unknown): string {
  const serialized = JSON.stringify(snapshotDriverValue(value, 0));
  if (
    serialized === undefined ||
    Buffer.byteLength(serialized, "utf8") > MAX_DRIVER_INPUT_BYTES
  ) {
    fail();
  }
  return serialized;
}

/** Recursively snapshots bounded own data without invoking accessors. */
function snapshotDriverValue(value: unknown, depth: number): unknown {
  if (depth > 8) fail();
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" &&
      Buffer.byteLength(value, "utf8") <= MAX_DRIVER_INPUT_BYTES)
  ) {
    return value;
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value)
  ) {
    return value;
  }
  if (value instanceof Date) return safeNow(value).toISOString();
  if (Array.isArray(value)) {
    if (value.length > 64) fail();
    return value.map((entry) => snapshotDriverValue(entry, depth + 1));
  }
  if (value === null || typeof value !== "object") fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length > 32 || keys.some((key) => typeof key !== "string")) {
    fail();
  }
  const result: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail();
    }
    result[key] = snapshotDriverValue(descriptor.value, depth + 1);
  }
  return result;
}

/** Reads one exact canonical timestamp driver response. */
function readDriverDate(value: unknown): Date {
  const record = exactRecord(value, ["at"]);
  return canonicalDate(ownData(record, "at"));
}

/** Admits a bounded command/executable element. */
function boundedCommandPart(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 1_024 ||
    /[\0\r\n]/u.test(value)
  ) {
    fail();
  }
  return value;
}

/** Admits a bounded driver argument without shell interpretation. */
function boundedDriverArgument(value: unknown): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > MAX_DRIVER_INPUT_BYTES ||
    value.includes("\0")
  ) {
    fail();
  }
  return value;
}

/** Admits one repository only for the in-process metadata adapter. */
function boundedRepository(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
  ) {
    fail();
  }
  return value;
}

/** Requires an exact ordinary record with no accessors or symbols. */
function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  return exactRecordWithOptional(value, keys, []);
}

/** Requires exact required keys plus only the declared optional keys. */
function exactRecordWithOptional(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    fail();
  }
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.some(
      (key) =>
        !required.includes(key as string) &&
        !optional.includes(key as string),
    ) ||
    required.some((key) => !keys.includes(key))
  ) {
    fail();
  }
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail();
    }
  }
  return record;
}

/** Reads one required own data property without invoking it. */
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

/** Reads one optional own data property without invoking it. */
function optionalOwnData(
  record: Record<string, unknown>,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined) return undefined;
  if (!descriptor.enumerable || !("value" in descriptor)) fail();
  return descriptor.value;
}

/** Recognizes the controller's closed families. */
function isControllerFamily(
  value: unknown,
): value is PreviewAcceptanceFamily {
  return (
    value === "foundation_probe" ||
    value === "preview_fault" ||
    value === "ai_usage" ||
    value === "sync_suppression" ||
    value === "role_probe" ||
    value === "restore" ||
    value === "calendar_maintenance"
  );
}

/** Recognizes the closed observer-state vocabulary. */
function isObserverState(
  value: unknown,
): value is "listening" | "succeeded" | "failed" {
  return (OBSERVER_STATES as readonly unknown[]).includes(value);
}

/** Recognizes the status-only stdout vocabulary. */
function isControllerStatus(
  value: unknown,
): value is PreviewAcceptanceStatus {
  return (CONTROLLER_STATUSES as readonly unknown[]).includes(value);
}

/** Admits one baseline marker or decimal run reference. */
function validLifecycleRunRef(value: unknown): value is string {
  return value === "baseline" || validRunRef(value);
}

/** Parses the controller executable's exact bounded arguments. */
function parseControllerArguments(arguments_: readonly string[]): {
  readonly inputPath: string;
  readonly driverExecutable: string;
  readonly repository: string;
  readonly driverPrefixArguments: readonly string[];
} {
  const single = new Map<string, string>();
  const prefixes: string[] = [];
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (flag === undefined || value === undefined) fail();
    if (flag === "--driver-prefix-argument") {
      if (prefixes.length >= 8) fail();
      prefixes.push(boundedCommandPart(value));
      continue;
    }
    if (
      flag !== "--input" &&
      flag !== "--driver" &&
      flag !== "--repository"
    ) {
      fail();
    }
    if (single.has(flag)) fail();
    single.set(flag, boundedCommandPart(value));
  }
  if (
    single.size !== 3 ||
    !single.has("--input") ||
    !single.has("--driver") ||
    !single.has("--repository")
  ) {
    fail();
  }
  return Object.freeze({
    inputPath: single.get("--input")!,
    driverExecutable: single.get("--driver")!,
    repository: boundedRepository(single.get("--repository")),
    driverPrefixArguments: Object.freeze(prefixes),
  });
}

/** Runs the real controller while keeping stdout status-only and stderr empty. */
async function main(): Promise<void> {
  let failedWritten = false;
  /** Writes one status token and tracks whether failure was already emitted. */
  const writeStatus = (status: PreviewAcceptanceStatus): void => {
    if (!isControllerStatus(status)) fail();
    if (status === "failed_closed") failedWritten = true;
    process.stdout.write(`${status}\n`);
  };
  try {
    const arguments_ = parseControllerArguments(process.argv.slice(2));
    const source = await readFile(arguments_.inputPath, "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_DRIVER_INPUT_BYTES) fail();
    const parsed = JSON.parse(source) as unknown;
    const controllerInput = snapshotControllerInput(
      parsed as PreviewAcceptanceControllerInput,
    );
    await runPreviewAcceptanceController(
      controllerInput,
      createPreviewControllerSubprocessDependencies({
        driverExecutable: arguments_.driverExecutable,
        driverPrefixArguments: arguments_.driverPrefixArguments,
        repository: arguments_.repository,
        writeStatus,
      }),
    );
  } catch {
    if (!failedWritten) writeStatus("failed_closed");
    process.exitCode = 1;
  }
}

/** Throws the sole controller error. */
function fail(): never {
  throw new Error(FAILURE);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
