/** Defines preview-only diagnostic fault admission and pure fact overlays. */
import { AI_HARD_STOP_CENTS } from "../budget/ai-budget";
import { FOUNDATION_HEALTH_THRESHOLDS, type FoundationHealthFacts } from "./health";

/** The only temporary acceptance scenarios admitted from a generated preview binding. */
export const TEMPORARY_PREVIEW_FAULT_SCENARIOS = Object.freeze([
  "queue_delayed",
  "job_failed",
  "channel_expired",
  "database_unavailable",
  "r2_upload_failed",
  "ai_stopped",
] as const);

/** Dedicated evidence selectors share deployment plumbing but never enter the fault tuple. */
export const TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS = Object.freeze([
  ...TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  "foundation_probe",
  "ai_usage",
] as const);

/** Closed scenario vocabulary shared by the scheduler, observer, and diagnostics overlay. */
export type TemporaryPreviewFaultScenario =
  (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number];

/** Closed candidate vocabulary used only by the generated preview artifact. */
export type TemporaryPreviewAcceptanceSelector =
  (typeof TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS)[number];

type PreviewFaultBinding = {
  readonly VISION_ENV?: unknown;
  readonly PREVIEW_ACCEPTANCE_SCENARIO?: unknown;
  readonly PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED?: unknown;
};

/** Admits one exact generated preview selector without collapsing evidence into faults. */
export function parseTemporaryPreviewAcceptanceSelector(
  environment: unknown,
): TemporaryPreviewAcceptanceSelector | undefined {
  if (environment === null || typeof environment !== "object") {
    throw new Error("Temporary preview acceptance selector is invalid.");
  }
  const binding = environment as PreviewFaultBinding;
  if (binding.PREVIEW_ACCEPTANCE_SCENARIO === undefined) return undefined;
  if (
    binding.VISION_ENV !== "preview" ||
    typeof binding.PREVIEW_ACCEPTANCE_SCENARIO !== "string" ||
    !TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS.includes(
      binding.PREVIEW_ACCEPTANCE_SCENARIO as TemporaryPreviewAcceptanceSelector,
    )
  ) {
    throw new Error("Temporary preview acceptance selector is invalid.");
  }
  return binding.PREVIEW_ACCEPTANCE_SCENARIO as TemporaryPreviewAcceptanceSelector;
}

/** Admits only the workflow-generated boolean for the dedicated AI evidence candidate. */
export function parseTemporaryPreviewAcceptanceAiGatewayAttestation(
  environment: unknown,
): boolean {
  if (environment === null || typeof environment !== "object") {
    throw invalidAiAttestation();
  }
  const binding = environment as PreviewFaultBinding;
  let selector: TemporaryPreviewAcceptanceSelector | undefined;
  try {
    selector = parseTemporaryPreviewAcceptanceSelector(binding);
  } catch {
    throw invalidAiAttestation();
  }
  if (selector === "ai_usage") {
    if (
      binding.PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED !== "true"
    ) {
      throw invalidAiAttestation();
    }
    return true;
  }
  if (
    binding.PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED !== undefined
  ) {
    throw invalidAiAttestation();
  }
  return false;
}

/**
 * Accepts one exact generated preview binding, permits an absent normal binding,
 * and rejects every attempted malformed or production activation.
 */
export function parseTemporaryPreviewFaultScenario(
  environment: unknown,
): TemporaryPreviewFaultScenario | undefined {
  if (environment === null || typeof environment !== "object") {
    throw invalidScenario();
  }
  const binding = environment as PreviewFaultBinding;
  if (binding.PREVIEW_ACCEPTANCE_SCENARIO === undefined) return undefined;
  if (
    binding.VISION_ENV !== "preview" ||
    typeof binding.PREVIEW_ACCEPTANCE_SCENARIO !== "string" ||
    !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
      binding.PREVIEW_ACCEPTANCE_SCENARIO as TemporaryPreviewFaultScenario,
    )
  ) {
    throw invalidScenario();
  }
  return binding.PREVIEW_ACCEPTANCE_SCENARIO as TemporaryPreviewFaultScenario;
}

/** Replaces only one minimum content-free health fact after authentication and owner admission. */
export function applyTemporaryPreviewFaultOverlay(
  scenario: TemporaryPreviewFaultScenario,
  facts: FoundationHealthFacts,
  now: Date,
): FoundationHealthFacts {
  switch (scenario) {
    case "queue_delayed":
      return Object.freeze({
        ...facts,
        oldestQueuedJobAt: new Date(
          now.getTime() - FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs,
        ),
      });
    case "job_failed":
      return Object.freeze({ ...facts, failedJobCount: Math.max(1, facts.failedJobCount) });
    case "channel_expired":
      return Object.freeze({ ...facts, channelExpiresAt: new Date(now.getTime() - 1) });
    case "database_unavailable":
      return Object.freeze({ ...facts, databaseAvailable: false });
    case "ai_stopped":
      return Object.freeze({ ...facts, aiMonthlyCents: AI_HARD_STOP_CENTS });
    case "r2_upload_failed":
      return facts;
  }
}

/** Uses one constant error so malformed generated configuration cannot disclose its input. */
function invalidScenario(): Error {
  return new Error("Temporary preview fault scenario is invalid.");
}

/** Uses one constant error so malformed AI attestation cannot disclose its input. */
function invalidAiAttestation(): Error {
  return new Error("Temporary preview AI Gateway attestation is invalid.");
}
