/** Coordinates guarded preview acceptance with one process-local observer. */
import { execFile, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
const OBSERVER_RESOLUTION_MILLISECONDS =
  UNIQUENESS_MILLISECONDS + POLL_MILLISECONDS;
const WORKFLOW_SETTLEMENT_MARGIN_MILLISECONDS = 60_000;
const CANDIDATE_WORKFLOW_MILLISECONDS =
  30 * 60_000 + WORKFLOW_SETTLEMENT_MARGIN_MILLISECONDS;
const ROLLBACK_WORKFLOW_MILLISECONDS =
  15 * 60_000 + WORKFLOW_SETTLEMENT_MARGIN_MILLISECONDS;
const CLOSURE_WORKFLOW_MILLISECONDS =
  15 * 60_000 + WORKFLOW_SETTLEMENT_MARGIN_MILLISECONDS;
const LOCAL_SIGNAL_MILLISECONDS = 50_000;
const PROVIDER_SIGNAL_MILLISECONDS = 59_000;
const APPROVAL_MILLISECONDS = 60_000;
const EXPIRY_BUFFER_MILLISECONDS = 60_000;
const PRE_IDLE_MILLISECONDS = 180_000;
const MAX_CHILD_OUTPUT_BYTES = 65_536;
const MAX_DRIVER_INPUT_BYTES = 8_192;
const REVIEWED_BRANCH = "codex/phase-b-foundation";
const REVIEWED_BRANCH_REF = `refs/heads/${REVIEWED_BRANCH}`;
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
  assertRemoteTip(
    commit: string,
    boundary: PreviewControllerCallBoundary,
  ): Promise<boolean>;
  dispatch(
    operation: PreviewAcceptanceOperation,
    serializedContext: string,
    boundary: PreviewControllerCallBoundary,
  ): Promise<{ readonly runRef: string }>;
  reconcileCandidateDispatch(input: {
    readonly operation: PreviewAcceptanceOperation;
    readonly serializedContext: string;
    readonly reviewedCommit: string;
  }, boundary: PreviewControllerCallBoundary): Promise<{
    readonly runRef: string;
  } | null>;
  resolveObserver(
    input: Readonly<Record<string, unknown>>,
    boundary: PreviewControllerCallBoundary,
  ): Promise<unknown>;
  readObserverState(
    handle: unknown,
    boundary: PreviewControllerCallBoundary,
  ): Promise<{
    readonly signal: "listening" | "succeeded" | "failed";
    readonly uniqueness: "listening" | "succeeded" | "failed";
    readonly signalObservedAt: Date | null;
    readonly uniquenessClosesAt?: Date | null;
  }>;
  verifyCandidateAttribution(input: {
    readonly runRef: string;
    readonly operation: PreviewAcceptanceOperation;
    readonly reviewedCommit: string;
  }, boundary: PreviewControllerCallBoundary): Promise<void>;
  awaitRollbackSettlement(
    input: PreviewAcceptanceRollbackSettlementInput,
    boundary: PreviewControllerCallBoundary,
  ): Promise<void>;
  admitRestore(input: {
    readonly priorCandidateRunRef: string;
    readonly rollbackClosureRunRef: string;
    readonly reviewedCommit: string;
  }, boundary: PreviewControllerCallBoundary): Promise<"verified">;
  requestApproval(
    input: PreviewAcceptanceApprovalInput,
    boundary: PreviewControllerCallBoundary,
  ): Promise<Date>;
  performAction(
    input: PreviewAcceptanceActionInput,
    boundary: PreviewControllerCallBoundary,
  ): Promise<Date>;
  verifyClosure(
    input: PreviewAcceptanceClosureInput,
    boundary: PreviewControllerCallBoundary,
  ): Promise<void>;
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

export interface PreviewAcceptanceRollbackSettlementInput
  extends PreviewAcceptanceActionInput {
  readonly rollbackRunRef: string;
}

export interface PreviewControllerCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

/** One absolute monotonic deadline and its interrupt signal. */
export interface PreviewControllerCallBoundary {
  readonly deadlineMonotonic: number;
  readonly signal: AbortSignal;
}

export type PreviewControllerCommandRunner = (
  executable: string,
  arguments_: readonly string[],
  boundary: PreviewControllerCallBoundary,
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
    boundary: PreviewControllerCallBoundary,
  ): Promise<PreviewControllerCommandResult> => {
    try {
      const result = await runCommand(executable, [...arguments_], boundary);
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
    arguments_: readonly string[],
    boundary: PreviewControllerCallBoundary,
  ): Promise<unknown> => {
    const result = await invoke(driverExecutable, [
      ...driverPrefixArguments,
      boundedCommandPart(command),
      ...arguments_.map(boundedDriverArgument),
    ], boundary);
    return parseDriverJsonLine(result.stdout);
  };

  /** Requires the driver's exact success acknowledgement. */
  const expectOk = async (
    command: string,
    arguments_: readonly string[],
    boundary: PreviewControllerCallBoundary,
  ): Promise<void> => {
    const record = exactRecord(
      await invokeDriver(command, arguments_, boundary),
      ["ok"],
    );
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
    assertRemoteTip: async (commit, boundary) => {
      const expectedCommit = validCommit(commit);
      const result = await invoke(gitExecutable, [
        "ls-remote",
        "--heads",
        "origin",
        REVIEWED_BRANCH_REF,
      ], boundary);
      const match =
        /^([a-f0-9]{40})\trefs\/heads\/codex\/phase-b-foundation\r?\n?$/u.exec(
          result.stdout,
        );
      if (match === null) fail();
      return match[1] === expectedCommit;
    },
    /** Dispatches one canonical operation/context pair. */
    dispatch: async (operation, serializedContext, boundary) => {
      const record = exactRecord(
        await invokeDriver(
          "dispatch",
          [operation, serializedContext],
          boundary,
        ),
        ["runRef"],
      );
      const runRef = ownData(record, "runRef");
      if (!validRunRef(runRef)) fail();
      return Object.freeze({ runRef });
    },
    /** Reconciles only the exact candidate dispatch tuple after uncertainty. */
    reconcileCandidateDispatch: async (candidate, boundary) => {
      const record = exactRecord(
        await invokeDriver("reconcile-candidate-dispatch", [
          candidate.operation,
          candidate.serializedContext,
          candidate.reviewedCommit,
        ], boundary),
        ["runRef"],
      );
      const runRef = ownData(record, "runRef");
      if (runRef === null) return null;
      if (!validRunRef(runRef)) fail();
      return Object.freeze({ runRef });
    },
    /** Resolves one observer while retaining only its opaque handle. */
    resolveObserver: async (resolutionInput, boundary) => {
      try {
        return await observerPort.resolveObserver(resolutionInput, boundary);
      } catch {
        fail();
      }
    },
    /** Reads one closed observer-state response. */
    readObserverState: async (handle, boundary) => {
      try {
        const state = await observerPort.readObserverState(handle, boundary);
        return snapshotControllerObserverState(state);
      } catch {
        fail();
      }
    },
    /** Verifies the candidate run and commit attribution. */
    verifyCandidateAttribution: (attribution, boundary) =>
      expectOk("verify-candidate-attribution", [
        attribution.runRef,
        attribution.operation,
        attribution.reviewedCommit,
      ], boundary),
    /** Waits for the exact rollback run to settle before closure dispatch. */
    awaitRollbackSettlement: (settlement, boundary) =>
      expectOk("await-rollback-settlement", [
        serializePreviewRollbackSettlementInput(settlement),
      ], boundary),
    /** Privately re-admits the immediately preceding role-probe closure. */
    admitRestore: async (admission, boundary) => {
      const record = exactRecord(
          await invokeDriver(
            "admit-restore",
            [serializeDriverInput(admission)],
            boundary,
          ),
        ["attestation"],
      );
      if (ownData(record, "attestation") !== "verified") fail();
      return "verified";
    },
    /** Requests approval and returns only its canonical instant. */
    requestApproval: async (action, boundary) =>
      readDriverDate(
        await invokeDriver("request-approval", [
          serializePreviewApprovalInput(action),
        ], boundary),
      ),
    /** Performs one admitted action and returns its completion instant. */
    performAction: async (action, boundary) =>
      readDriverDate(
        await invokeDriver(isUserMediatedFamily(action.family)
          ? "perform-action"
          : "confirm-candidate-deployment", [
          serializePreviewActionInput(action),
        ], boundary),
      ),
    /** Verifies the exact rollback-closure binding. */
    verifyClosure: (closure, boundary) =>
      expectOk(
        "verify-closure",
        [serializePreviewClosureInput(closure)],
        boundary,
      ),
    /** Writes only one admitted controller status. */
    writeStatus: (status) => {
      if (!isControllerStatus(status)) fail();
      (input.writeStatus ??
        ((value) => process.stdout.write(`${value}\n`)))(status);
    },
  };
  return Object.freeze(dependencies);
}

/** Runs one controller dependency within an absolute, interruptible deadline. */
async function runControllerCall<T>(
  requestedDeadlineMonotonic: number,
  dependencies: PreviewAcceptanceControllerDependencies,
  operation: (boundary: PreviewControllerCallBoundary) => Promise<T>,
  maximumDurationMilliseconds = UNIQUENESS_MILLISECONDS,
): Promise<T> {
  const now = safeMonotonic(dependencies.monotonicNow());
  const maximumDuration = safeMonotonic(maximumDurationMilliseconds);
  if (maximumDuration <= 0) fail();
  const deadlineMonotonic = Math.min(
    safeMonotonic(requestedDeadlineMonotonic),
    now + maximumDuration,
  );
  const remaining = deadlineMonotonic - now;
  if (remaining <= 0) fail();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  timer = setTimeout(() => {
    controller.abort();
  }, remaining);
  try {
    const result = await operation(
      Object.freeze({
        deadlineMonotonic,
        signal: controller.signal,
      }),
    );
    if (controller.signal.aborted) fail();
    return result;
  } catch {
    throw new Error(FAILURE);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Executes observer, candidate, rollback, and uniqueness fail-closed. */
export async function runPreviewAcceptanceController(
  input: PreviewAcceptanceControllerInput,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  input = snapshotControllerInput(input);
  const reviewedCommit = validCommit(input.reviewedCommit);
  const expiresAt = canonicalDate(input.expiresAt);
  /** Bounds each pre-signal child by both observer and expiry windows. */
  const nextPreSignalDeadline = (): number => {
    const wall = safeNow(dependencies.wallNow());
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    const expiryRemaining =
      expiresAt.getTime() - EXPIRY_BUFFER_MILLISECONDS - wall.getTime();
    if (expiryRemaining <= 0) fail();
    return monotonic + Math.min(UNIQUENESS_MILLISECONDS, expiryRemaining);
  };
  /** Grants bounded cleanup time after an attributed candidate must fail. */
  const nextCleanupDeadline = (): number => {
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    return safeMonotonic(monotonic + UNIQUENESS_MILLISECONDS);
  };
  /** Preserves the resolver's terminal poll without crossing candidate expiry. */
  const nextObserverResolutionDeadline = (): number => {
    const wall = safeNow(dependencies.wallNow());
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    const expiryRemaining =
      expiresAt.getTime() - EXPIRY_BUFFER_MILLISECONDS - wall.getTime();
    if (expiryRemaining <= 0) fail();
    return monotonic + Math.min(
      OBSERVER_RESOLUTION_MILLISECONDS,
      expiryRemaining,
    );
  };
  /** Bounds a long-running candidate confirmation by its actual expiry. */
  const nextCandidateWorkflowDeadline = (): number => {
    const wall = safeNow(dependencies.wallNow());
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    const expiryRemaining =
      expiresAt.getTime() - EXPIRY_BUFFER_MILLISECONDS - wall.getTime();
    if (expiryRemaining <= 0) fail();
    return monotonic + Math.min(
      CANDIDATE_WORKFLOW_MILLISECONDS,
      expiryRemaining,
    );
  };
  /** Grants one fresh provider-workflow settlement window. */
  const nextWorkflowDeadline = (durationMilliseconds: number): number => {
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    return safeMonotonic(
      monotonic + safeMonotonic(durationMilliseconds),
    );
  };
  /** Grants a fresh post-closure window including one terminal poll margin. */
  const nextVerificationDeadline = (): number => {
    const monotonic = safeMonotonic(dependencies.monotonicNow());
    return safeMonotonic(
      monotonic + UNIQUENESS_MILLISECONDS + POLL_MILLISECONDS,
    );
  };
  let candidateRunRef: string | null = null;
  let rollbackRunRef: string | null = null;
  let rollbackStarted = false;

  /** Serializes every dispatch through the canonical closed context. */
  const dispatch = async (
    context: PreviewAcceptanceContext,
    deadlineMonotonic: number,
    beforeDispatch?: () => void,
  ): Promise<{
    readonly runRef: string;
    readonly reconciledAfterFailure: boolean;
    readonly reconciledAfterTimeout: boolean;
  }> => {
    if (
      !(await runControllerCall(
        deadlineMonotonic,
        dependencies,
        (boundary) => dependencies.assertRemoteTip(reviewedCommit, boundary),
      ))
    ) {
      fail();
    }
    beforeDispatch?.();
    const serializedContext = serializePreviewAcceptanceContext(context);
    let result: { readonly runRef: string };
    let dispatchSignal: AbortSignal | undefined;
    let reconciledAfterFailure = false;
    let reconciledAfterTimeout = false;
    try {
      result = await runControllerCall(
        deadlineMonotonic,
        dependencies,
        (boundary) => {
          dispatchSignal = boundary.signal;
          return dependencies.dispatch(
            context.kind,
            serializedContext,
            boundary,
          );
        },
      );
    } catch {
      if (
        context.kind === "observe" ||
        context.kind === "close_rollback"
      ) {
        fail();
      }
      const reconciliationInput = Object.freeze({
        operation: context.kind,
        serializedContext,
        reviewedCommit,
      });
      reconciledAfterFailure = true;
      reconciledAfterTimeout = dispatchSignal?.aborted === true;
      const reconciled = await runControllerCall(
        nextCleanupDeadline(),
        dependencies,
        (boundary) =>
          dependencies.reconcileCandidateDispatch(
            reconciliationInput,
            boundary,
          ),
      );
      if (reconciled === null) fail();
      result = reconciled;
    }
    if (!validRunRef(result?.runRef)) fail();
    return Object.freeze({
      runRef: result.runRef,
      reconciledAfterFailure,
      reconciledAfterTimeout,
    });
  };

  /** Immediately restores and closes one attributed candidate. */
  const rollbackAndClose = async (
    deadlineMonotonic: number,
    signal?: {
    readonly detectedAtMonotonic: number;
    readonly providerObservedAt: Date;
    },
  ): Promise<void> => {
    if (candidateRunRef === null || rollbackStarted) return;
    rollbackStarted = true;
    const rollbackCandidateRunRef = candidateRunRef;
    const rollbackOperation = candidateOperation(input.family);
    const rollback = await dispatch(
      {
        version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
        kind: "rollback",
        reviewedCommit,
        candidateRunRef: rollbackCandidateRunRef,
      },
      deadlineMonotonic,
      signal === undefined
        ? undefined
        : () => assertRollbackDispatchDeadline(signal, dependencies),
    );
    rollbackRunRef = rollback.runRef;
    const completedRollbackRunRef = rollback.runRef;
    if (rollback.reconciledAfterFailure) {
      await runControllerCall(
        nextCleanupDeadline(),
        dependencies,
        (boundary) =>
          dependencies.verifyCandidateAttribution(
            Object.freeze({
              runRef: completedRollbackRunRef,
              operation: "rollback",
              reviewedCommit,
            }),
            boundary,
          ),
      );
    }
    dependencies.writeStatus("rollback_dispatched");
    const settlementDeadline = nextWorkflowDeadline(
      ROLLBACK_WORKFLOW_MILLISECONDS,
    );
    await runControllerCall(
      settlementDeadline,
      dependencies,
      (boundary) =>
        dependencies.awaitRollbackSettlement(
          Object.freeze({
            family: input.family,
            operation: rollbackOperation,
            candidateRunRef: rollbackCandidateRunRef,
            rollbackRunRef: completedRollbackRunRef,
            reviewedCommit,
          }),
          boundary,
        ),
      ROLLBACK_WORKFLOW_MILLISECONDS,
    );
    const closureDispatchDeadline = nextCleanupDeadline();
    const closure = await dispatch({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "close_rollback",
      reviewedCommit,
      candidateRunRef: rollbackCandidateRunRef,
      rollbackRunRef: completedRollbackRunRef,
      authenticatedReadsGate: "verified",
    }, closureDispatchDeadline);
    const closureVerificationDeadline = nextWorkflowDeadline(
      CLOSURE_WORKFLOW_MILLISECONDS,
    );
    await runControllerCall(
      closureVerificationDeadline,
      dependencies,
      (boundary) =>
        dependencies.verifyClosure(
          {
            family: input.family,
            operation: rollbackOperation,
            candidateRunRef: rollbackCandidateRunRef,
            rollbackRunRef: completedRollbackRunRef,
            closureRunRef: closure.runRef,
            reviewedCommit,
          },
          boundary,
        ),
      CLOSURE_WORKFLOW_MILLISECONDS,
    );
    dependencies.writeStatus("closure_verified");
    if (rollback.reconciledAfterFailure) fail();
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
    await dispatch(observeContext, nextPreSignalDeadline());
    const observerCompletedAt = safeNow(dependencies.wallNow());
    const observer = await runControllerCall(
      nextObserverResolutionDeadline(),
      dependencies,
      (boundary) =>
        dependencies.resolveObserver(
          {
            family: input.family,
            expectedCommit: reviewedCommit,
            dispatchStartedAt: observerStartedAt,
            dispatchCompletedAt: observerCompletedAt,
            expectation: input.expectation,
          },
          boundary,
        ),
      OBSERVER_RESOLUTION_MILLISECONDS,
    );
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
        ? await admitRestore(
            input,
            reviewedCommit,
            nextPreSignalDeadline(),
            dependencies,
          )
        : undefined;
    const candidate = await dispatch(createCandidateContext(
      input,
      operation,
      reviewedCommit,
      observerStartedAt,
      observerCompletedAt,
      restoreAdmission,
    ), nextPreSignalDeadline());
    const candidateDispatchReturnedAt = safeNow(dependencies.wallNow());
    const attributedCandidateRunRef = candidate.runRef;
    candidateRunRef = attributedCandidateRunRef;
    const candidateAttribution = Object.freeze({
      runRef: attributedCandidateRunRef,
      operation,
      reviewedCommit,
    });
    await runControllerCall(
      nextPreSignalDeadline(),
      dependencies,
      (boundary) =>
        dependencies.verifyCandidateAttribution(
          candidateAttribution,
          boundary,
        ),
    );
    dependencies.writeStatus("candidate_dispatched");
    if (candidate.reconciledAfterTimeout) {
      await rollbackAndClose(nextCleanupDeadline());
      fail();
    }

    const actionInput = Object.freeze({
      family: input.family,
      operation,
      candidateRunRef: attributedCandidateRunRef,
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
        await runControllerCall(
          nextPreSignalDeadline(),
          dependencies,
          (boundary) =>
            dependencies.requestApproval(
              {
                ...actionInput,
                expiresAt: input.expiresAt,
              },
              boundary,
            ),
        ),
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
        await runControllerCall(
          nextPreSignalDeadline(),
          dependencies,
          (boundary) => dependencies.performAction(actionInput, boundary),
        ),
      );
      if (actionCompletedAt.getTime() < beforeAction.getTime()) fail();
    } else {
      actionCompletedAt = safeNow(
        await runControllerCall(
          nextCandidateWorkflowDeadline(),
          dependencies,
          (boundary) => dependencies.performAction(actionInput, boundary),
          CANDIDATE_WORKFLOW_MILLISECONDS,
        ),
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
    if (signal.kind === "no_signal") {
      await rollbackAndClose(nextCleanupDeadline());
      if (!isTwoJobFamily(input.family)) fail();
      await waitForNoSignalUniqueness(
        observer,
        nextVerificationDeadline(),
        dependencies,
      );
      fail();
    }
    dependencies.writeStatus("candidate_signal_seen");
    await rollbackAndClose(
      rollbackCallDeadline(signal, dependencies),
      {
        detectedAtMonotonic: signal.detectedAtMonotonic,
        providerObservedAt: signal.providerObservedAt,
      },
    );

    if (isTwoJobFamily(input.family)) {
      let state = signal.state;
      if (
        state.uniquenessClosesAt === undefined ||
        state.uniquenessClosesAt === null
      ) fail();
      const uniquenessClosesAt = safeNow(state.uniquenessClosesAt);
      const verificationStartedAtWall = safeNow(dependencies.wallNow());
      const verificationStartedAtMonotonic = safeMonotonic(
        dependencies.monotonicNow(),
      );
      const semanticCloseRemaining =
        uniquenessClosesAt.getTime() + POLL_MILLISECONDS -
        verificationStartedAtWall.getTime();
      const uniquenessDeadline = safeMonotonic(
        verificationStartedAtMonotonic + Math.max(
          UNIQUENESS_MILLISECONDS + POLL_MILLISECONDS,
          semanticCloseRemaining,
        ),
      );
      for (;;) {
        const currentUniquenessClosesAt = state.uniquenessClosesAt;
        if (
          state.signal !== "succeeded" ||
          state.signalObservedAt === null ||
          safeNow(state.signalObservedAt).getTime() !==
            signal.providerObservedAt.getTime() ||
          currentUniquenessClosesAt === undefined ||
          currentUniquenessClosesAt === null ||
          safeNow(currentUniquenessClosesAt).getTime() !==
            uniquenessClosesAt.getTime()
        ) {
          fail();
        }
        const detectedAtWall = safeNow(dependencies.wallNow());
        const detectedAtMonotonic = safeMonotonic(
          dependencies.monotonicNow(),
        );
        if (
          state.uniqueness === "failed" ||
          detectedAtMonotonic > uniquenessDeadline
        ) fail();
        if (
          state.uniqueness === "succeeded" &&
          detectedAtWall.getTime() >= uniquenessClosesAt.getTime()
        ) break;
        const remaining = Math.min(
          POLL_MILLISECONDS,
          uniquenessDeadline - detectedAtMonotonic,
          state.uniqueness === "succeeded"
            ? uniquenessClosesAt.getTime() - detectedAtWall.getTime()
            : POLL_MILLISECONDS,
        );
        if (remaining <= 0) fail();
        await dependencies.sleep(remaining);
        state = await runControllerCall(
          uniquenessDeadline,
          dependencies,
          (boundary) => dependencies.readObserverState(observer, boundary),
        );
      }
    }
  } catch {
    if (candidateRunRef !== null && !rollbackStarted) {
      try {
        await rollbackAndClose(nextCleanupDeadline());
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
): Promise<
  | {
      readonly kind: "signal";
      readonly state: Awaited<
        ReturnType<
          PreviewAcceptanceControllerDependencies["readObserverState"]
        >
      >;
      readonly detectedAtMonotonic: number;
      readonly providerObservedAt: Date;
    }
  | {
      readonly kind: "no_signal";
    }
> {
  for (;;) {
    const beforeReadWall = safeNow(dependencies.wallNow());
    const beforeReadMonotonic = safeMonotonic(
      dependencies.monotonicNow(),
    );
    if (
      beforeReadWall.getTime() > absoluteNoSignalDeadline.getTime() ||
      beforeReadMonotonic > noSignalDeadline
    ) {
      fail();
    }
    if (
      beforeReadWall.getTime() === absoluteNoSignalDeadline.getTime() ||
      beforeReadMonotonic === noSignalDeadline
    ) {
      return Object.freeze({ kind: "no_signal" as const });
    }
    const state = await runControllerCall(
      noSignalDeadline,
      dependencies,
      (boundary) => dependencies.readObserverState(observer, boundary),
    );
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
        observedAt.getTime() > detectedAtWall.getTime() ||
        observedAt.getTime() > absoluteNoSignalDeadline.getTime()
      ) {
        fail();
      }
      return Object.freeze({
        kind: "signal" as const,
        state,
        detectedAtMonotonic,
        providerObservedAt: observedAt,
      });
    }
    if (safeMonotonic(dependencies.monotonicNow()) >= noSignalDeadline) {
      return Object.freeze({ kind: "no_signal" as const });
    }
    const remaining =
      noSignalDeadline - safeMonotonic(dependencies.monotonicNow());
    if (remaining <= 0) fail();
    await dependencies.sleep(Math.min(POLL_MILLISECONDS, remaining));
  }
}

/** Requires the no-signal two-job observer to fail only after rollback close. */
async function waitForNoSignalUniqueness(
  observer: unknown,
  verificationDeadline: number,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  let stableClosesAt: Date | null = null;
  for (;;) {
    const state = await runControllerCall(
      verificationDeadline,
      dependencies,
      (boundary) => dependencies.readObserverState(observer, boundary),
    );
    const detectedAtWall = safeNow(dependencies.wallNow());
    const detectedAtMonotonic = safeMonotonic(
      dependencies.monotonicNow(),
    );
    const providerClosesAt = state.uniquenessClosesAt;
    if (providerClosesAt === undefined || providerClosesAt === null) {
      if (stableClosesAt !== null) fail();
    } else {
      const currentClosesAt = safeNow(providerClosesAt);
      if (
        stableClosesAt !== null &&
        stableClosesAt.getTime() !== currentClosesAt.getTime()
      ) fail();
      stableClosesAt ??= currentClosesAt;
    }
    if (
      detectedAtMonotonic > verificationDeadline ||
      state.signal !== "listening" ||
      state.signalObservedAt !== null ||
      state.uniqueness === "succeeded"
    ) {
      fail();
    }
    if (state.uniqueness === "failed") {
      if (
        stableClosesAt !== null &&
        detectedAtWall.getTime() < stableClosesAt.getTime()
      ) fail();
      return;
    }
    const remaining = Math.min(
      POLL_MILLISECONDS,
      verificationDeadline - detectedAtMonotonic,
      stableClosesAt !== null &&
          detectedAtWall.getTime() < stableClosesAt.getTime()
        ? stableClosesAt.getTime() - detectedAtWall.getTime()
        : POLL_MILLISECONDS,
    );
    if (remaining <= 0) fail();
    await dependencies.sleep(remaining);
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

/** Derives the tighter absolute post-signal child deadline. */
function rollbackCallDeadline(
  signal: {
    readonly detectedAtMonotonic: number;
    readonly providerObservedAt: Date;
  },
  dependencies: PreviewAcceptanceControllerDependencies,
): number {
  const nowMonotonic = safeMonotonic(dependencies.monotonicNow());
  const nowWall = safeNow(dependencies.wallNow());
  const localDeadline =
    signal.detectedAtMonotonic + LOCAL_SIGNAL_MILLISECONDS;
  const providerRemaining =
    signal.providerObservedAt.getTime() +
    PROVIDER_SIGNAL_MILLISECONDS -
    nowWall.getTime();
  const providerDeadline = nowMonotonic + providerRemaining;
  const deadline = Math.min(localDeadline, providerDeadline);
  if (providerRemaining <= 0 || deadline < nowMonotonic) fail();
  return safeMonotonic(deadline + 1);
}

/** Maps one wall-clock close to an absolute monotonic deadline. */
function monotonicDeadlineForWall(
  wallDeadline: Date,
  dependencies: PreviewAcceptanceControllerDependencies,
): number {
  const nowWall = safeNow(dependencies.wallNow());
  const nowMonotonic = safeMonotonic(dependencies.monotonicNow());
  const remaining = safeNow(wallDeadline).getTime() - nowWall.getTime();
  if (remaining <= 0) fail();
  return nowMonotonic + remaining;
}

/** Waits through the reserved post-close settlement margin. */
async function waitForMaintenanceUniqueness(
  observer: unknown,
  closesAt: Date,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  const anchorWall = safeNow(dependencies.wallNow());
  const anchorMonotonic = safeMonotonic(dependencies.monotonicNow());
  const settlementAt = new Date(
    closesAt.getTime() + UNIQUENESS_MILLISECONDS,
  );
  const settlementRemaining =
    settlementAt.getTime() - anchorWall.getTime();
  if (settlementRemaining < 0) fail();
  const settlementMonotonic =
    anchorMonotonic + settlementRemaining;
  for (;;) {
    const state = await runControllerCall(
      settlementMonotonic,
      dependencies,
      (boundary) => dependencies.readObserverState(observer, boundary),
    );
    const detectedAtWall = safeNow(dependencies.wallNow());
    const detectedAtMonotonic = safeMonotonic(
      dependencies.monotonicNow(),
    );
    if (
      state.uniqueness === "failed" ||
      detectedAtWall.getTime() > settlementAt.getTime() ||
      detectedAtMonotonic < anchorMonotonic ||
      detectedAtMonotonic > settlementMonotonic
    ) {
      fail();
    }
    if (
      state.uniqueness === "succeeded" &&
      detectedAtWall.getTime() >= closesAt.getTime()
    ) {
      return;
    }
    const remaining = Math.min(
      POLL_MILLISECONDS,
      settlementAt.getTime() - detectedAtWall.getTime(),
      settlementMonotonic - detectedAtMonotonic,
      state.uniqueness === "succeeded"
        ? closesAt.getTime() - detectedAtWall.getTime()
        : Number.POSITIVE_INFINITY,
    );
    if (remaining <= 0) fail();
    await dependencies.sleep(remaining);
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
  deadlineMonotonic: number,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<"verified"> {
  if (
    !validRunRef(input.priorCandidateRunRef) ||
    !validRunRef(input.rollbackClosureRunRef)
  ) {
    fail();
  }
  const priorCandidateRunRef = input.priorCandidateRunRef;
  const rollbackClosureRunRef = input.rollbackClosureRunRef;
  const attestation = await runControllerCall(
    deadlineMonotonic,
    dependencies,
    (boundary) =>
      dependencies.admitRestore(
        {
          priorCandidateRunRef,
          rollbackClosureRunRef,
          reviewedCommit,
        },
        boundary,
      ),
  );
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
    resolveObserver: async (value, boundary) => {
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
        boundary,
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
    readObserverState: async (opaque, boundary) => {
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
          boundary,
        );
      }
      if (state.family === "calendar_maintenance") {
        if (state.maintenanceScheduledAt === null) fail();
        const maintenance = await readPreviewMaintenanceObserverState(
          state.handle,
          state.family,
          state.maintenanceScheduledAt,
          dependencies,
          boundary,
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
        boundary,
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
  readonly uniquenessClosesAt?: Date | null;
} {
  const record = exactRecordWithOptional(
    value,
    ["signal", "signalObservedAt", "uniqueness"],
    ["uniquenessClosesAt"],
  );
  const signal = ownData(record, "signal");
  const uniqueness = ownData(record, "uniqueness");
  const observed = ownData(record, "signalObservedAt");
  const closesAt = optionalOwnData(record, "uniquenessClosesAt");
  if (
    !isObserverState(signal) ||
    !isObserverState(uniqueness) ||
    (signal === "succeeded" && !(observed instanceof Date)) ||
    (signal !== "succeeded" && observed !== null) ||
    (closesAt !== undefined &&
      closesAt !== null &&
      !(closesAt instanceof Date))
  ) {
    fail();
  }
  return Object.freeze({
    signal,
    uniqueness,
    signalObservedAt: observed === null ? null : safeNow(observed as Date),
    ...(closesAt === undefined
      ? {}
      : {
          uniquenessClosesAt:
            closesAt === null ? null : safeNow(closesAt as Date),
        }),
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

/** Serializes one exact rollback-settlement input. */
function serializePreviewRollbackSettlementInput(
  input: PreviewAcceptanceRollbackSettlementInput,
): string {
  validateActionInput(input);
  if (!validRunRef(input.rollbackRunRef)) fail();
  return serializeDriverInput({
    reviewedCommit: input.reviewedCommit,
    family: input.family,
    operation: input.operation,
    candidateRunRef: input.candidateRunRef,
    rollbackRunRef: input.rollbackRunRef,
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
  boundary: PreviewControllerCallBoundary,
): Promise<PreviewControllerCommandResult> {
  const remaining =
    safeMonotonic(boundary.deadlineMonotonic) -
    safeMonotonic(performance.now());
  if (remaining <= 0 || boundary.signal.aborted) fail();
  try {
    return await new Promise<PreviewControllerCommandResult>(
      (resolvePromise, rejectPromise) => {
        let child: ChildProcess | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let terminationRequested = false;

        /** Releases the timer and abort listener for the child invocation. */
        const cleanup = (): void => {
          if (timer !== null) clearTimeout(timer);
          boundary.signal.removeEventListener("abort", terminate);
        };
        /** Rejects the child invocation with the sole public controller error. */
        const rejectClosed = (): void => {
          rejectPromise(new Error(FAILURE));
        };
        /** Requests child termination while deferring settlement until close. */
        const terminate = (): void => {
          terminationRequested = true;
          if (child !== null && !child.killed) {
            try {
              child.kill();
            } catch {
              // The callback remains the sole settlement point so the child is
              // always observed as closed before control returns.
            }
          }
        };

        try {
          child = execFile(
            executable,
            [...arguments_],
            {
              encoding: "utf8",
              maxBuffer: MAX_CHILD_OUTPUT_BYTES,
              windowsHide: true,
            },
            (error, stdout, stderr) => {
              cleanup();
              if (
                error !== null ||
                terminationRequested ||
                typeof stdout !== "string" ||
                typeof stderr !== "string"
              ) {
                rejectClosed();
                return;
              }
              resolvePromise(Object.freeze({ stdout, stderr }));
            },
          );
        } catch {
          cleanup();
          rejectClosed();
          return;
        }

        boundary.signal.addEventListener("abort", terminate, { once: true });
        timer = setTimeout(terminate, remaining);
        if (boundary.signal.aborted) terminate();
      },
    );
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
