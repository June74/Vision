/** Calculates privacy-safe foundation health from timestamped operational facts. */
import {
  AI_HARD_STOP_CENTS,
  AI_OPTIONAL_STOP_CENTS,
  AI_WARNING_CENTS,
} from "../budget/ai-budget";

/** Four user-visible operational states ordered by recovery urgency. */
export type HealthState =
  | "Healthy"
  | "Delayed"
  | "Action required"
  | "Disconnected";

/** Authorization facts that do not disclose provider credentials. */
export type AuthorizationState = "connected" | "missing" | "revoked";

/** Content-free checkpoint states persisted by the synchronization pipeline. */
export type DiagnosticCheckpointStatus =
  | "pending"
  | "connected"
  | "disconnected"
  | "action_required"
  | "rebuild_required"
  | "retry_scheduled";

/** Allowlisted synchronization error categories safe to show in diagnostics. */
export type DiagnosticSafeErrorCode =
  | "authorization"
  | "concurrency"
  | "database"
  | "provider"
  | "payload_too_large"
  | "quota"
  | "schema"
  | "sync_token_invalid"
  | "transient";

/** Exact freshness windows shared by the repository, API, and tests. */
export const FOUNDATION_HEALTH_THRESHOLDS = Object.freeze({
  syncFreshnessMs: 20 * 60_000,
  queueFreshnessMs: 15 * 60_000,
  channelRenewalWarningMs: 24 * 60 * 60_000,
});
const DIAGNOSTIC_SAFE_ERROR_CODES = [
  "authorization",
  "concurrency",
  "database",
  "provider",
  "payload_too_large",
  "quota",
  "schema",
  "sync_token_invalid",
  "transient",
] as const;

/** Timestamped, content-free inputs accepted by the health policy. */
export interface FoundationHealthFacts {
  readonly authorizationState: AuthorizationState;
  readonly checkpointStatus: DiagnosticCheckpointStatus;
  readonly lastSuccessfulSyncAt: Date | null;
  readonly oldestQueuedJobAt: Date | null;
  readonly queueRetryCount: number;
  readonly failedJobCount: number;
  readonly channelExpiresAt: Date | null;
  readonly databaseAvailable: boolean;
  readonly databaseUsageWarning: boolean;
  readonly r2UsageWarning: boolean;
  readonly aiMonthlyCents: number;
  readonly safeErrorCode: DiagnosticSafeErrorCode | null;
}

/** AI availability tier exposed without coupling deterministic features to AI. */
export type AiSpendTier =
  | "normal"
  | "warning"
  | "optional_stopped"
  | "stopped";

/** Deterministic health result containing ages and allowlisted warning codes only. */
export interface FoundationHealth {
  readonly state: HealthState;
  readonly syncDelayMs: number | null;
  readonly oldestJobDelayMs: number | null;
  readonly aiSpendTier: AiSpendTier;
  readonly warningCodes: readonly string[];
}

/** Applies disconnected, actionable, delayed, then healthy precedence to validated facts. */
export function calculateFoundationHealth(
  facts: FoundationHealthFacts,
  now: Date,
): FoundationHealth {
  validateFoundationHealthFacts(facts, now);
  const nowMs = now.getTime();
  const syncDelayMs =
    facts.lastSuccessfulSyncAt === null
      ? null
      : nowMs - facts.lastSuccessfulSyncAt.getTime();
  const oldestJobDelayMs =
    facts.oldestQueuedJobAt === null
      ? null
      : nowMs - facts.oldestQueuedJobAt.getTime();
  const warnings: string[] = [];

  const disconnected =
    facts.authorizationState !== "connected" ||
    facts.checkpointStatus === "disconnected" ||
    facts.safeErrorCode === "authorization";
  if (facts.authorizationState === "revoked") {
    warnings.push("AUTHORIZATION_REVOKED");
  } else if (
    facts.authorizationState === "missing" ||
    facts.checkpointStatus === "disconnected"
  ) {
    warnings.push("AUTHORIZATION_MISSING");
  }

  let actionRequired = false;
  if (!facts.databaseAvailable) {
    warnings.push("DATABASE_UNAVAILABLE");
    actionRequired = true;
  }
  if (facts.failedJobCount > 0) {
    warnings.push("FAILED_JOBS");
    actionRequired = true;
  }
  if (facts.checkpointStatus === "action_required") {
    warnings.push("SYNC_ACTION_REQUIRED");
    actionRequired = true;
  }
  if (
    facts.safeErrorCode === "database" ||
    facts.safeErrorCode === "payload_too_large" ||
    facts.safeErrorCode === "schema"
  ) {
    warnings.push("SYNC_ACTION_REQUIRED");
    actionRequired = true;
  }
  if (facts.channelExpiresAt === null) {
    warnings.push("CHANNEL_MISSING");
    actionRequired = true;
  } else if (facts.channelExpiresAt.getTime() <= nowMs) {
    warnings.push("CHANNEL_EXPIRED");
    actionRequired = true;
  }
  if (facts.databaseUsageWarning) {
    warnings.push("DATABASE_USAGE_WARNING");
    actionRequired = true;
  }
  if (facts.r2UsageWarning) {
    warnings.push("R2_USAGE_WARNING");
    actionRequired = true;
  }

  let delayed = false;
  if (
    syncDelayMs === null ||
    syncDelayMs >= FOUNDATION_HEALTH_THRESHOLDS.syncFreshnessMs
  ) {
    warnings.push(syncDelayMs === null ? "SYNC_NOT_YET_COMPLETED" : "SYNC_DELAYED");
    delayed = true;
  }
  if (
    oldestJobDelayMs !== null &&
    oldestJobDelayMs >= FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs
  ) {
    warnings.push("QUEUE_DELAYED");
    delayed = true;
  }
  if (
    facts.channelExpiresAt !== null &&
    facts.channelExpiresAt.getTime() > nowMs &&
    facts.channelExpiresAt.getTime() - nowMs <=
      FOUNDATION_HEALTH_THRESHOLDS.channelRenewalWarningMs
  ) {
    warnings.push("CHANNEL_EXPIRING");
    delayed = true;
  }
  if (
    facts.checkpointStatus === "pending" ||
    facts.checkpointStatus === "rebuild_required" ||
    facts.checkpointStatus === "retry_scheduled" ||
    facts.safeErrorCode === "concurrency" ||
    facts.safeErrorCode === "provider" ||
    facts.safeErrorCode === "quota" ||
    facts.safeErrorCode === "sync_token_invalid" ||
    facts.safeErrorCode === "transient"
  ) {
    warnings.push("SYNC_DELAYED");
    delayed = true;
  }

  const aiSpendTier = classifyAiSpend(facts.aiMonthlyCents);
  if (aiSpendTier === "warning") warnings.push("AI_BUDGET_WARNING");
  if (aiSpendTier === "optional_stopped") {
    warnings.push("AI_OPTIONAL_STOPPED");
  }
  if (aiSpendTier === "stopped") warnings.push("AI_BUDGET_STOPPED");

  return Object.freeze({
    state: disconnected
      ? "Disconnected"
      : actionRequired
        ? "Action required"
        : delayed
          ? "Delayed"
          : "Healthy",
    syncDelayMs,
    oldestJobDelayMs,
    aiSpendTier,
    warningCodes: Object.freeze([...new Set(warnings)]),
  });
}

/** Maps exact monthly cent boundaries to a display-only availability tier. */
function classifyAiSpend(monthlyCents: number): AiSpendTier {
  if (monthlyCents >= AI_HARD_STOP_CENTS) return "stopped";
  if (monthlyCents >= AI_OPTIONAL_STOP_CENTS) return "optional_stopped";
  if (monthlyCents >= AI_WARNING_CENTS) return "warning";
  return "normal";
}

/** Rejects malformed or future operational facts instead of emitting false health. */
function validateFoundationHealthFacts(
  facts: FoundationHealthFacts,
  now: Date,
): void {
  /** Accepts a nullable finite timestamp only when it is not ahead of observation time. */
  const validDate = (value: Date | null): boolean =>
    value === null ||
    (value instanceof Date &&
      !Number.isNaN(value.getTime()) &&
      value.getTime() <= now.getTime());
  const validChannelDate =
    facts.channelExpiresAt === null ||
    (facts.channelExpiresAt instanceof Date &&
      !Number.isNaN(facts.channelExpiresAt.getTime()));
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime()) ||
    !["connected", "missing", "revoked"].includes(
      facts.authorizationState,
    ) ||
    ![
      "pending",
      "connected",
      "disconnected",
      "action_required",
      "rebuild_required",
      "retry_scheduled",
    ].includes(facts.checkpointStatus) ||
    !validDate(facts.lastSuccessfulSyncAt) ||
    !validDate(facts.oldestQueuedJobAt) ||
    !validChannelDate ||
    !Number.isSafeInteger(facts.queueRetryCount) ||
    facts.queueRetryCount < 0 ||
    !Number.isSafeInteger(facts.failedJobCount) ||
    facts.failedJobCount < 0 ||
    typeof facts.databaseAvailable !== "boolean" ||
    typeof facts.databaseUsageWarning !== "boolean" ||
    typeof facts.r2UsageWarning !== "boolean" ||
    !Number.isSafeInteger(facts.aiMonthlyCents) ||
    facts.aiMonthlyCents < 0 ||
    (facts.safeErrorCode !== null &&
      !DIAGNOSTIC_SAFE_ERROR_CODES.includes(facts.safeErrorCode))
  ) {
    throw new Error("Invalid foundation health facts.");
  }
}
