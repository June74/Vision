/** Defines preview-only diagnostic fault admission and pure fact overlays. */
import {
  AI_HARD_STOP_CENTS,
  getChicagoBudgetMonth,
} from "../budget/ai-budget";
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
  "sync_suppression",
  "role_probe",
  "restore",
] as const);

/** Closed scenario vocabulary shared by the scheduler, observer, and diagnostics overlay. */
export type TemporaryPreviewFaultScenario =
  (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number];

/** Closed candidate vocabulary used only by the generated preview artifact. */
export type TemporaryPreviewAcceptanceSelector =
  (typeof TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS)[number];

/** Inclusive UTC minute at which temporary preview activation becomes unsafe. */
export const PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE = 5 * 60 + 35;

/** Exclusive UTC minute at which temporary preview activation becomes safe again. */
export const PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE = 6 * 60 + 35;

/** Maximum time from candidate construction through evidence and rollback. */
export const PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES = 30;

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;
const CANONICAL_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const INVALID_TIMING = "Preview acceptance timing is unavailable.";

type PreviewFaultBinding = {
  readonly VISION_ENV?: unknown;
  readonly PREVIEW_ACCEPTANCE_SCENARIO?: unknown;
  readonly PREVIEW_ACCEPTANCE_EXPIRES_AT?: unknown;
  readonly PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT?: unknown;
  readonly PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED?: unknown;
};

/** One exact temporary interval in which a single AI evidence tick may run. */
export interface PreviewAiEvidenceWindow {
  readonly activatedAt: Date;
  readonly evidenceScheduledAt: Date;
  readonly expiresAt: Date;
}

const AI_EVIDENCE_LIFETIME_MILLISECONDS =
  PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
const AI_REQUEST_MARGIN_MILLISECONDS = 90_000;
const AI_ROLLBACK_BOUND_MILLISECONDS = 60_000;
const PERMANENT_QUARTER_HOUR_MILLISECONDS = 15 * MILLISECONDS_PER_MINUTE;
const DAILY_SCHEDULE_UTC_MINUTE = 6 * 60 + 5;

/** Creates the sole canonical 30-minute AI window before observer dispatch. */
export function createPreviewAiEvidenceWindow(
  activatedAt: Date,
): PreviewAiEvidenceWindow {
  const unadjustedActivation = validAcceptanceInstant(activatedAt);
  const unadjustedExpiry =
    unadjustedActivation + AI_EVIDENCE_LIFETIME_MILLISECONDS;
  const equalityShift =
    unadjustedExpiry % MILLISECONDS_PER_MINUTE === 0 ? 1 : 0;
  const activation = unadjustedActivation + equalityShift;
  const expiry = unadjustedExpiry + equalityShift;
  const evidenceScheduledAt =
    Math.floor(expiry / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
  return validatedPreviewAiEvidenceWindow(
    activation,
    evidenceScheduledAt,
    expiry,
  );
}

/** Parses only the exact AI-only scheduled-at binding and snapshots its dates. */
export function parseTemporaryPreviewAiEvidenceWindow(
  environment: unknown,
): PreviewAiEvidenceWindow | undefined {
  try {
    if (environment === null || typeof environment !== "object") {
      throw invalidAiWindow();
    }
    const prototype = Object.getPrototypeOf(environment);
    if (prototype !== Object.prototype && prototype !== null) {
      throw invalidAiWindow();
    }
    const record = environment as Readonly<Record<string, unknown>>;
    const visionEnv = ownDataValue(record, "VISION_ENV");
    const selector = ownDataValue(record, "PREVIEW_ACCEPTANCE_SCENARIO");
    const scheduled = ownDataValue(
      record,
      "PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT",
    );
    const expires = ownDataValue(record, "PREVIEW_ACCEPTANCE_EXPIRES_AT");
    if (selector !== "ai_usage") {
      if (scheduled !== undefined) throw invalidAiWindow();
      return undefined;
    }
    if (
      visionEnv !== "preview" ||
      !canonicalInstant(scheduled) ||
      !canonicalInstant(expires)
    ) {
      throw invalidAiWindow();
    }
    const expiry = Date.parse(expires);
    const evidenceScheduledAt = Date.parse(scheduled);
    const activation = expiry - AI_EVIDENCE_LIFETIME_MILLISECONDS;
    return validatedPreviewAiEvidenceWindow(
      activation,
      evidenceScheduledAt,
      expiry,
    );
  } catch {
    throw invalidAiWindow();
  }
}

/** Requires a candidate to retain the full live-request margin. */
export function assertPreviewAiRequestMargin(
  now: Date,
  evidenceScheduledAt: Date,
): void {
  const current = validAcceptanceInstant(now);
  const evidence = validAcceptanceInstant(evidenceScheduledAt);
  if (evidence - current < AI_REQUEST_MARGIN_MILLISECONDS) {
    throw new Error(INVALID_TIMING);
  }
}

/** Validates the whole canonical AI interval and returns detached frozen dates. */
function validatedPreviewAiEvidenceWindow(
  activation: number,
  evidenceScheduledAt: number,
  expiry: number,
): PreviewAiEvidenceWindow {
  if (
    !Number.isFinite(activation) ||
    !Number.isFinite(evidenceScheduledAt) ||
    !Number.isFinite(expiry) ||
    expiry - activation !== AI_EVIDENCE_LIFETIME_MILLISECONDS ||
    evidenceScheduledAt % MILLISECONDS_PER_MINUTE !== 0 ||
    Math.floor(expiry / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE !==
      evidenceScheduledAt ||
    !(activation < evidenceScheduledAt) ||
    !(evidenceScheduledAt < expiry) ||
    !(expiry < evidenceScheduledAt + MILLISECONDS_PER_MINUTE)
  ) {
    throw new Error(INVALID_TIMING);
  }
  const activatedDate = new Date(activation);
  const evidenceDate = new Date(evidenceScheduledAt);
  const expiresDate = new Date(expiry);
  if (getChicagoBudgetMonth(activatedDate) !== getChicagoBudgetMonth(expiresDate)) {
    throw new Error(INVALID_TIMING);
  }
  assertAvailableAcceptanceInterval(activation, expiry);
  assertAiRollbackAvoidsPermanentSchedules(expiresDate);
  return Object.freeze({
    activatedAt: Object.freeze(new Date(activation)),
    evidenceScheduledAt: Object.freeze(new Date(evidenceScheduledAt)),
    expiresAt: Object.freeze(new Date(expiry)),
  });
}

/** Prevents post-expiry rollback from crossing permanent scheduled work. */
export function assertAiRollbackAvoidsPermanentSchedules(
  expiresAt: Date,
): void {
  const expiry = validAcceptanceInstant(expiresAt);
  const rollbackEndsAt = expiry + AI_ROLLBACK_BOUND_MILLISECONDS;
  const nextQuarterHour =
    Math.floor(expiry / PERMANENT_QUARTER_HOUR_MILLISECONDS + 1) *
    PERMANENT_QUARTER_HOUR_MILLISECONDS;
  if (nextQuarterHour < rollbackEndsAt) throw new Error(INVALID_TIMING);

  const firstDay = Math.floor(expiry / MILLISECONDS_PER_DAY) - 1;
  const lastDay = Math.floor(rollbackEndsAt / MILLISECONDS_PER_DAY) + 1;
  for (let day = firstDay; day <= lastDay; day += 1) {
    const daily =
      day * MILLISECONDS_PER_DAY +
      DAILY_SCHEDULE_UTC_MINUTE * MILLISECONDS_PER_MINUTE;
    if (daily > expiry && daily < rollbackEndsAt) {
      throw new Error(INVALID_TIMING);
    }
  }
}

/** Reads one own enumerable data property without invoking accessors. */
function ownDataValue(
  record: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

/** Accepts only one byte-stable UTC timestamp string. */
function canonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_INSTANT.test(value)) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}

/** Returns the exact maximum lifetime admitted for one acceptance selector. */
export function previewAcceptanceMaxLifetimeMinutes(
  selector: TemporaryPreviewAcceptanceSelector,
): 10 | 30 {
  return selector === "sync_suppression" ? 10 : 30;
}

/** Fails closed when the complete selector lifetime touches recovery. */
export function assertPreviewAcceptanceWindow(
  now: Date,
  selector: TemporaryPreviewAcceptanceSelector,
): void {
  const startsAt = validAcceptanceInstant(now);
  assertAvailableAcceptanceInterval(
    startsAt,
    startsAt +
      previewAcceptanceMaxLifetimeMinutes(selector) * MILLISECONDS_PER_MINUTE,
  );
}

/** Creates the only candidate deadline after checking its whole lifetime. */
export function createPreviewAcceptanceDeadline(
  activatedAt: Date,
  selector: TemporaryPreviewAcceptanceSelector,
): string {
  assertPreviewAcceptanceWindow(activatedAt, selector);
  return new Date(
    validAcceptanceInstant(activatedAt) +
      previewAcceptanceMaxLifetimeMinutes(selector) * MILLISECONDS_PER_MINUTE,
  ).toISOString();
}

/** Rechecks the remaining candidate lifetime against expiry and recovery. */
export function assertPreviewAcceptanceLifetime(
  now: Date,
  expiresAt: unknown,
  selector: TemporaryPreviewAcceptanceSelector,
): void {
  const startsAt = validAcceptanceInstant(now);
  if (typeof expiresAt !== "string" || !CANONICAL_INSTANT.test(expiresAt)) {
    throw new Error(INVALID_TIMING);
  }
  const endsAt = Date.parse(expiresAt);
  if (
    !Number.isFinite(endsAt) ||
    new Date(endsAt).toISOString() !== expiresAt ||
    endsAt <= startsAt ||
    endsAt - startsAt >
      previewAcceptanceMaxLifetimeMinutes(selector) * MILLISECONDS_PER_MINUTE
  ) {
    throw new Error(INVALID_TIMING);
  }
  assertAvailableAcceptanceInterval(startsAt, endsAt);
}

/** Applies the runtime guard to one already-admitted candidate environment. */
export function assertTemporaryPreviewAcceptanceLifetime(
  now: Date,
  environment: unknown,
): void {
  if (environment === null || typeof environment !== "object") {
    throw new Error(INVALID_TIMING);
  }
  let selector: TemporaryPreviewAcceptanceSelector | undefined;
  try {
    selector = parseTemporaryPreviewAcceptanceSelector(environment);
  } catch {
    throw new Error(INVALID_TIMING);
  }
  if (selector === undefined) throw new Error(INVALID_TIMING);
  assertPreviewAcceptanceLifetime(
    now,
    (environment as PreviewFaultBinding).PREVIEW_ACCEPTANCE_EXPIRES_AT,
    selector,
  );
}

/** Returns a finite instant or fails closed for invalid or forged Date values. */
function validAcceptanceInstant(value: Date): number {
  const instant = Date.prototype.getTime.call(value);
  if (!Number.isFinite(instant)) throw new Error(INVALID_TIMING);
  return instant;
}

/** Rejects any candidate interval that intersects the protected UTC window. */
function assertAvailableAcceptanceInterval(
  startsAt: number,
  endsAt: number,
): void {
  if (endsAt <= startsAt) throw new Error(INVALID_TIMING);
  const firstDay = Math.floor(startsAt / MILLISECONDS_PER_DAY) - 1;
  const lastDay = Math.floor(endsAt / MILLISECONDS_PER_DAY) + 1;
  for (let day = firstDay; day <= lastDay; day += 1) {
    const blockedStartsAt =
      day * MILLISECONDS_PER_DAY +
      PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE * MILLISECONDS_PER_MINUTE;
    const blockedEndsAt =
      day * MILLISECONDS_PER_DAY +
      PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE * MILLISECONDS_PER_MINUTE;
    if (startsAt < blockedEndsAt && endsAt > blockedStartsAt) {
      throw new Error(INVALID_TIMING);
    }
  }
}

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

/** Uses one constant error so malformed AI-window values cannot disclose input. */
function invalidAiWindow(): Error {
  return new Error("Temporary preview AI evidence window is invalid.");
}
