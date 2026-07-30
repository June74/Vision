/** Coordinates guarded preview acceptance with an in-memory observer handle. */
import { assertSyncSuppressionMargin } from "./validate-preview-sync-acceptance";

const FAILURE = "Preview acceptance controller failed closed.";
export type PreviewAcceptanceStatus =
  | "observer_ready" | "candidate_dispatched" | "candidate_signal_seen"
  | "rollback_dispatched" | "closure_verified" | "failed_closed";

export interface PreviewAcceptanceControllerDependencies {
  wallNow(): Date;
  monotonicNow(): number;
  sleep(milliseconds: number): Promise<void>;
  assertRemoteTip(commit: string): Promise<boolean>;
  dispatch(operation: string, context: Readonly<Record<string, unknown>>): Promise<void>;
  resolveObserver(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  readObserverState(handle: unknown): Promise<{
    readonly signal: string;
    readonly uniqueness: string;
    readonly signalObservedAt: Date | null;
  }>;
  requestApproval(): Promise<Date>;
  performAction(): Promise<Date>;
  verifyClosure(): Promise<void>;
  writeStatus(status: PreviewAcceptanceStatus): void;
}

export interface PreviewAcceptanceControllerInput {
  readonly family: string;
  readonly reviewedCommit: string;
  readonly expiresAt: string;
  readonly expectation: Readonly<Record<string, unknown>>;
  readonly restoreAdmissionGate?: "verified";
}

/** Executes observer, candidate, rollback, and closure fail-closed. */
export async function runPreviewAcceptanceController(
  input: PreviewAcceptanceControllerInput,
  dependencies: PreviewAcceptanceControllerDependencies,
): Promise<void> {
  let candidateDispatched = false;
  let approvalObtained = false;
  /** Rechecks the immutable branch tip immediately before dispatch. */
  const dispatch = async (operation: string, context: Readonly<Record<string, unknown>>) => {
    if (!(await dependencies.assertRemoteTip(input.reviewedCommit))) throw new Error(FAILURE);
    await dependencies.dispatch(operation, context);
  };
  try {
    const observerStartedAt = dependencies.wallNow();
    await dispatch("observe", {
      family: input.family,
      expectation: input.expectation,
      reviewedCommit: input.reviewedCommit,
    });
    const observerCompletedAt = dependencies.wallNow();
    const observer = await dependencies.resolveObserver({
      family: input.family,
      expectedCommit: input.reviewedCommit,
      dispatchStartedAt: observerStartedAt,
      dispatchCompletedAt: observerCompletedAt,
    });
    dependencies.writeStatus("observer_ready");
    if (input.family === "sync_suppression") {
      assertSyncSuppressionMargin(dependencies.wallNow(), input.expiresAt, "before_approval");
    }
    const approvedAt = await dependencies.requestApproval();
    approvalObtained = true;
    const now = dependencies.wallNow();
    if (now.getTime() - approvedAt.getTime() > 60_000) throw new Error(FAILURE);
    if (input.family === "sync_suppression") {
      assertSyncSuppressionMargin(approvedAt, input.expiresAt, "before_edit");
    }
    await dependencies.performAction();
    const operation = input.family === "restore"
      ? "deploy_restore"
      : input.family === "role_probe"
        ? "deploy_role_probe"
        : input.family === "sync_suppression"
          ? "deploy_sync_suppression"
          : input.family === "ai_usage"
            ? "deploy_ai"
            : input.family === "preview_fault"
              ? "deploy_fault"
              : "deploy_foundation";
    await dispatch(operation, {
      reviewedCommit: input.reviewedCommit,
      ...(input.restoreAdmissionGate ? { restoreAdmissionGate: input.restoreAdmissionGate } : {}),
    });
    candidateDispatched = true;
    dependencies.writeStatus("candidate_dispatched");
    for (;;) {
      const state = await dependencies.readObserverState(observer);
      if (state.signal === "succeeded" && state.uniqueness === "succeeded") break;
      await dependencies.sleep(5_000);
    }
    dependencies.writeStatus("candidate_signal_seen");
    await dispatch("rollback", { reviewedCommit: input.reviewedCommit });
    dependencies.writeStatus("rollback_dispatched");
    await dispatch("close_rollback", { reviewedCommit: input.reviewedCommit });
    await dependencies.verifyClosure();
    dependencies.writeStatus("closure_verified");
  } catch {
    if (candidateDispatched || approvalObtained) {
      try {
        await dispatch("rollback", { reviewedCommit: input.reviewedCommit });
        dependencies.writeStatus("rollback_dispatched");
      } catch { /* fixed failure surface below */ }
    }
    dependencies.writeStatus("failed_closed");
    throw new Error(FAILURE);
  }
}
