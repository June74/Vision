/**
 * Records which stage of the Google OAuth pipeline failed, using a closed set of constant category
 * codes so a preview deployment can be diagnosed without any code, cookie, token, claim, or secret.
 */

/**
 * Closed set of authentication failure stages. Every member is a fixed literal chosen at authoring
 * time, so no request, provider, or account value can ever reach a log sink or an HTTP response
 * through this channel.
 */
export const AUTH_DIAGNOSTIC_STAGES = [
  "start_dependencies_unavailable",
  "start_admission_key_failed",
  "start_protocol_values_failed",
  "start_transaction_write_failed",
  "start_transaction_rejected",
  "start_refresh_lookup_failed",
  "start_authorization_url_failed",
  "callback_dependencies_unavailable",
  "callback_query_invalid",
  "callback_state_not_found",
  "callback_code_exchange_failed",
  "callback_scope_rejected",
  "callback_id_token_invalid",
  "callback_claims_invalid",
  "callback_account_not_allowed",
  "callback_token_persist_failed",
  "callback_authorization_recovery_failed",
  "callback_session_rotation_failed",
  "callback_session_create_failed",
  "unclassified",
] as const;

/** One constant authentication failure category from the closed diagnostic set. */
export type AuthDiagnosticStage = (typeof AUTH_DIAGNOSTIC_STAGES)[number];

/** HTTP header that carries the failure category on preview deployments only. */
export const AUTH_DIAGNOSTIC_HEADER = "X-Vision-Auth-Diagnostic";

/** Tags one thrown authentication failure with its pipeline stage without copying any request value. */
export class AuthStageError extends Error {
  readonly stage: AuthDiagnosticStage;

  /** Retains only the constant stage code and the original cause, never a message derived from it. */
  constructor(stage: AuthDiagnosticStage, cause?: unknown) {
    super("AUTH_STAGE_FAILED", { cause });
    this.name = "AuthStageError";
    this.stage = stage;
  }
}

/** Runs one authentication pipeline stage and rewrites any thrown value into a stage-tagged failure. */
export async function runAuthStage<Result>(
  stage: AuthDiagnosticStage,
  operation: () => Result | Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error) {
    // An inner stage tag is already the more precise fact, so it is never overwritten by an outer stage.
    throw error instanceof AuthStageError ? error : new AuthStageError(stage, error);
  }
}

/** Reads the recorded stage of a failure, defaulting to the unclassified category. */
export function readAuthDiagnosticStage(error: unknown): AuthDiagnosticStage {
  return error instanceof AuthStageError ? error.stage : "unclassified";
}

/** Returns the original thrown value behind any stage tag so callers can branch on domain errors. */
export function readAuthFailureCause(error: unknown): unknown {
  return error instanceof AuthStageError ? error.cause : error;
}

/** Admits the failure category into a response only on preview, keeping local and production constant. */
export function readPreviewDiagnosticStage(
  environment: string | undefined,
  stage: AuthDiagnosticStage,
): AuthDiagnosticStage | undefined {
  return environment === "preview" ? stage : undefined;
}
