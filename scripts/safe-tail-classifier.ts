/** Parses only closed recovery and temporary-restore evidence from Wrangler JSON. */
import { BACKUP_TABLES } from "../src/domain/backup/manifest";
import type { CalendarMaintenanceEvidence } from "../src/jobs/calendar-maintenance-evidence";
import type { TemporarySyncSuppressionEvidence } from "../src/server/webhooks/temporary-preview-sync-suppression";
import type {
  TemporaryRestoreEvidence,
  TemporaryRestoreFailureCategory,
} from "../src/jobs/temporary-preview-restore";
import type {
  TemporaryPreviewRoleProbeEvidence,
  TemporaryPreviewRoleProbeFailureCategory,
} from "../src/jobs/temporary-preview-role-probe";
import {
  createPhaseBFoundationProbeEvidence,
  PHASE_B_FOUNDATION_PROBE_ACTION,
  type PhaseBFoundationProbeCategory,
  type PhaseBFoundationProbeEvidence,
  type PhaseBFoundationProbeMeasurements,
} from "../src/jobs/phase-b-foundation-probe";
import {
  createPhaseBAiUsageEvidence,
  PHASE_B_AI_USAGE_ACTION,
  type PhaseBAiUsageEvidence,
} from "../src/jobs/phase-b-ai-usage-evidence";
import {
  createTemporaryPreviewFaultEvidence,
  TEMPORARY_PREVIEW_FAULT_ACTION,
  type TemporaryPreviewFaultEvidence,
} from "../src/jobs/temporary-preview-fault";
import {
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  type TemporaryPreviewFaultScenario,
} from "../src/domain/operations/temporary-preview-fault";

/** Closed, privacy-safe recovery evidence emitted from one Wrangler JSON tail line. */
export interface SafeTailEvidence {
  readonly cron: "temporary_recovery" | "daily_recovery";
  readonly outcome:
    | "ok"
    | "exception"
    | "exceeded_cpu"
    | "canceled"
    | "unknown";
  readonly category:
    | "none"
    | "backup_creation_failed"
    | "backup_storage_read_failed"
    | "backup_storage_write_failed"
    | "backup_verification_failed"
    | "backup_retention_listing_failed"
    | "backup_retention_deletion_failed"
    | "backup_storage_unavailable"
    | "backup_key_invalid"
    | "scheduled_cron_unsupported"
    | "unknown_failure";
}

/** The only evidence objects that the safe tail may emit. */
export type SafeTailResult =
  | SafeTailEvidence
  | CalendarMaintenanceEvidence
  | TemporaryRestoreEvidence
  | TemporaryPreviewRoleProbeEvidence
  | PhaseBFoundationProbeEvidence
  | PhaseBAiUsageEvidence
  | TemporaryPreviewFaultEvidence
  | TemporarySyncSuppressionEvidence;

/** Closed acceptance result required after structural evidence classification. */
export type PreviewObserverAcceptanceExpectation =
  | { readonly kind: "sync_suppressed" }
  | { readonly kind: "foundation_succeeded" }
  | {
      readonly kind: "fault_expected";
      readonly scenario: TemporaryPreviewFaultScenario;
    }
  | { readonly kind: "role_probe_succeeded" }
  | { readonly kind: "restore_succeeded" }
  | {
      readonly kind: "maintenance_succeeded";
      readonly maintenanceScheduledAt: string;
    }
  | {
      readonly kind: "maintenance_repair_reserved";
      readonly maintenanceScheduledAt: string;
    }
  | { readonly kind: "ai_succeeded" };

const FAILURE_MARKERS = Object.freeze([
  ["Backup creation failed.", "backup_creation_failed"],
  ["Backup storage read failed.", "backup_storage_read_failed"],
  ["Backup storage write failed.", "backup_storage_write_failed"],
  ["Backup verification failed.", "backup_verification_failed"],
  ["Backup retention listing failed.", "backup_retention_listing_failed"],
  ["Backup retention deletion failed.", "backup_retention_deletion_failed"],
  ["Backup object storage is unavailable.", "backup_storage_unavailable"],
  ["Backup key binding is invalid.", "backup_key_invalid"],
  ["Scheduled cron is unsupported.", "scheduled_cron_unsupported"],
] as const);
const RESTORE_FAILURE_CATEGORIES = Object.freeze([
  "restore_configuration_invalid",
  "restore_candidate_invalid",
  "restore_object_verification_failed",
  "restore_backup_validation_failed",
  "restore_target_attestation_failed",
  "restore_target_not_empty",
  "restore_promotion_failed",
  "restore_readback_verification_failed",
  "restore_unknown_failure",
] as const satisfies readonly TemporaryRestoreFailureCategory[]);
const RESTORE_FAILURE_KEYS = Object.freeze([
  "category",
  "evidenceType",
  "outcome",
] as const);
const RESTORE_SUCCESS_KEYS = Object.freeze([
  "authoritativeTableCount",
  "category",
  "checksumMatches",
  "eventCount",
  "eventListReadable",
  "evidenceType",
  "format",
  "keyVersion",
  "outcome",
  "referencesValid",
  "replacedExisting",
  "rowCounts",
  "schemaVersion",
  "targetWasEmpty",
] as const);
const ROLE_PROBE_FAILURE_CATEGORIES = Object.freeze([
  "role_probe_configuration_invalid",
  "role_probe_query_failed",
  "role_probe_role_mismatch",
] as const satisfies readonly TemporaryPreviewRoleProbeFailureCategory[]);
const ROLE_PROBE_KEYS = Object.freeze([
  "category",
  "evidenceType",
  "outcome",
  "roleMatches",
] as const);
const CALENDAR_MAINTENANCE_KEYS = Object.freeze([
  "category",
  "evidenceType",
  "maintenanceScheduledAt",
  "outcome",
  "renewalOutcome",
  "repairOutcome",
] as const);
const PHASE_B_FOUNDATION_KEYS = Object.freeze([
  "backupContractMatches",
  "category",
  "checkpointViolations",
  "databaseBytes",
  "domainViolations",
  "evidenceType",
  "identityViolations",
  "outcome",
  "privacyViolations",
  "privilegesMatch",
  "protectedStorageMatches",
  "provenanceViolations",
  "publicGrantCount",
  "r2Bytes",
  "r2ObjectCount",
  "referenceViolations",
  "roleMatches",
  "schemaMatches",
  "sentinelStatus",
] as const);
const PHASE_B_FOUNDATION_SOURCE_CATEGORIES = Object.freeze([
  "configuration_invalid",
  "database_unavailable",
  "r2_unavailable",
] as const satisfies readonly PhaseBFoundationProbeCategory[]);
const PHASE_B_FOUNDATION_INTEGER_KEYS = Object.freeze([
  "publicGrantCount",
  "identityViolations",
  "domainViolations",
  "privacyViolations",
  "provenanceViolations",
  "referenceViolations",
  "checkpointViolations",
  "databaseBytes",
  "r2ObjectCount",
  "r2Bytes",
] as const satisfies readonly (keyof PhaseBFoundationProbeMeasurements)[]);
const MAX_TAIL_EVENT_BYTES = 1_048_576;
const CALENDAR_MAINTENANCE_CRON = "*/15 * * * *";
const AI_USAGE_EVIDENCE_TYPE = "vision.ai-usage/v1";
const AI_USAGE_KEYS = Object.freeze([
  "category",
  "evidenceType",
  "gatewayLimitMatches",
  "hardStopAtCents",
  "monthlyCents",
  "nonAiAvailable",
  "optionalStopAtCents",
  "outcome",
  "tier",
  "warningAtCents",
] as const);
const TEMPORARY_PREVIEW_FAULT_KEYS = Object.freeze([
  "category",
  "evidenceType",
  "outcome",
  "scenario",
] as const);
const TERMINAL_IDENTITIES = Object.freeze([
  {
    action: "calendar.maintenance",
    evidenceType: "vision.calendar-maintenance/v2",
    kind: "calendar_maintenance",
  },
  {
    action: "backup.restore",
    evidenceType: "vision.preview-restore/v1",
    kind: "preview_restore",
  },
  {
    action: "backup.restore-role-probe",
    evidenceType: "vision.preview-role-probe/v1",
    kind: "preview_role_probe",
  },
  {
    action: PHASE_B_FOUNDATION_PROBE_ACTION,
    evidenceType: "vision.phase-b-foundation-probe/v1",
    kind: "phase_b_foundation",
  },
  {
    action: PHASE_B_AI_USAGE_ACTION,
    evidenceType: AI_USAGE_EVIDENCE_TYPE,
    kind: "phase_b_ai_usage",
  },
  {
    action: TEMPORARY_PREVIEW_FAULT_ACTION,
    evidenceType: "vision.preview-fault/v1",
    kind: "temporary_preview_fault",
  },
  {
    action: "acceptance.sync-suppression",
    evidenceType: "vision.sync-suppression/v1",
    kind: "sync_suppression",
  },
] as const);
type TerminalKind = (typeof TERMINAL_IDENTITIES)[number]["kind"];

/** Incrementally assembles Wrangler's pretty-printed JSON without emitting it. */
export function createSafeTailAccumulator(): {
  push(line: string): SafeTailResult | null;
} {
  let buffer = "";
  return Object.freeze({
    /** Accepts one raw line and emits only a completed allowlisted event. */
    push(line: string): SafeTailResult | null {
      const trimmed = line.trimStart();
      if (buffer.length === 0 && !trimmed.startsWith("{")) return null;
      buffer += `${line}\n`;
      if (buffer.length > MAX_TAIL_EVENT_BYTES) {
        buffer = "";
        return null;
      }
      try {
        JSON.parse(buffer);
      } catch {
        return null;
      }
      const evidence = classifySafeTailLine(buffer);
      buffer = "";
      return evidence;
    },
  });
}

/** Parses one raw tail line while copying no provider-controlled content. */
export function classifySafeTailLine(line: string): SafeTailResult | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(line);
  } catch {
    return null;
  }
  const tail = snapshotOwnEnumerableData(candidate);
  const event = snapshotOwnEnumerableData(tail?.event);
  if (!tail || !event) return null;
  if (hasMixedTerminalKinds(tail.logs)) return null;
  const maintenance = locateCalendarMaintenanceEvidence(tail.logs);
  if (maintenance.seen) {
    return event.cron === CALENDAR_MAINTENANCE_CRON
      ? maintenance.evidence
      : null;
  }
  if (event.cron === CALENDAR_MAINTENANCE_CRON) return null;
  const cron =
    event.cron === "* * * * *"
      ? "temporary_recovery"
      : event.cron === "5 6 * * *"
        ? "daily_recovery"
        : null;
  if (!cron) return null;

  const foundation = locatePhaseBFoundationProbeEvidence(tail.logs);
  if (foundation.evidence) {
    return cron === "temporary_recovery" ? foundation.evidence : null;
  }
  if (foundation.seen) return null;

  const fault = locateTemporaryPreviewFaultEvidence(tail.logs);
  if (fault.evidence) {
    return cron === "temporary_recovery" ? fault.evidence : null;
  }
  if (fault.seen) return null;

  const aiUsage = locatePhaseBAiUsageEvidence(tail.logs);
  if (aiUsage.evidence) return cron === "temporary_recovery" ? aiUsage.evidence : null;
  if (aiUsage.seen) return null;

  const roleProbe = locateTemporaryPreviewRoleProbeEvidence(tail.logs);
  if (roleProbe.evidence) {
    return cron === "temporary_recovery" ? roleProbe.evidence : null;
  }
  if (roleProbe.seen) return null;

  const restore = locateTemporaryRestoreEvidence(tail.logs);
  if (restore.evidence) {
    return cron === "temporary_recovery" ? restore.evidence : null;
  }
  if (restore.seen) return null;

  const suppression = locateSyncSuppressionEvidence(tail.logs);
  if (suppression.evidence) {
    return cron === "temporary_recovery" ? suppression.evidence : null;
  }
  if (suppression.seen) return null;

  const marker = findFailureMarker(candidate);
  const outcome = normalizeOutcome(tail.outcome);
  return Object.freeze({
    category:
      marker ??
      (outcome === "ok" ? "none" : "unknown_failure"),
    cron,
    outcome,
  });
}

/** Reconstructs one exact AI-usage terminal record without copying tail-controlled data. */
export function classifyPhaseBAiUsageEvidence(
  candidate: unknown,
): PhaseBAiUsageEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (!isPhaseBAiUsageEvidenceShape(evidence)) return null;
  if (isCanonicalUnavailableAiUsageEvidence(evidence)) {
    return createUnavailableAiUsageEvidence();
  }
  const reconstructed = createPhaseBAiUsageEvidence({
    monthlyCents: evidence.monthlyCents,
    gatewayLimitMatches: evidence.gatewayLimitMatches,
    nonAiAvailable: evidence.nonAiAvailable,
  });
  return matchesPhaseBAiUsageEvidence(evidence, reconstructed)
    ? reconstructed
    : null;
}

/** Reconstructs the exact four-key preview-fault record without copying tail-controlled extras. */
export function classifyTemporaryPreviewFaultEvidence(
  candidate: unknown,
): TemporaryPreviewFaultEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (
    !evidence ||
    !hasExactKeys(evidence, TEMPORARY_PREVIEW_FAULT_KEYS) ||
    evidence.evidenceType !== "vision.preview-fault/v1" ||
    typeof evidence.scenario !== "string" ||
    !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
      evidence.scenario as TemporaryPreviewFaultScenario,
    )
  ) {
    return null;
  }
  const reconstructed = createTemporaryPreviewFaultEvidence(
    evidence.scenario as TemporaryPreviewFaultScenario,
  );
  return (
    evidence.outcome === reconstructed.outcome &&
    evidence.category === reconstructed.category
  )
    ? reconstructed
    : null;
}

/** Requires the exact AI key set and primitive inputs used for reconstruction. */
function isPhaseBAiUsageEvidenceShape(
  evidence: Record<string, unknown> | null,
): evidence is Record<string, unknown> & {
  readonly monthlyCents: number;
  readonly gatewayLimitMatches: boolean;
  readonly nonAiAvailable: boolean;
} {
  return (
    evidence !== null &&
    hasExactKeys(evidence, AI_USAGE_KEYS) &&
    evidence.evidenceType === AI_USAGE_EVIDENCE_TYPE &&
    typeof evidence.monthlyCents === "number" &&
    typeof evidence.gatewayLimitMatches === "boolean" &&
    typeof evidence.nonAiAvailable === "boolean"
  );
}

/** Recognizes the producer's sole source-unavailable AI evidence form. */
function isCanonicalUnavailableAiUsageEvidence(
  evidence: Record<string, unknown>,
): boolean {
  return (
    evidence.category === "unavailable" &&
    evidence.outcome === "failed" &&
    evidence.monthlyCents === 0 &&
    evidence.gatewayLimitMatches === false &&
    evidence.nonAiAvailable === false &&
    evidence.warningAtCents === 800 &&
    evidence.optionalStopAtCents === 900 &&
    evidence.hardStopAtCents === 950 &&
    evidence.tier === "normal"
  );
}

/** Rebuilds the source-unavailable record from fixed allowlisted values only. */
function createUnavailableAiUsageEvidence(): PhaseBAiUsageEvidence {
  return Object.freeze({
    evidenceType: AI_USAGE_EVIDENCE_TYPE,
    outcome: "failed",
    category: "unavailable",
    monthlyCents: 0,
    warningAtCents: 800,
    optionalStopAtCents: 900,
    hardStopAtCents: 950,
    tier: "normal",
    gatewayLimitMatches: false,
    nonAiAvailable: false,
  });
}

/** Confirms that every derived AI field matches the canonical reconstruction. */
function matchesPhaseBAiUsageEvidence(
  candidate: Record<string, unknown>,
  reconstructed: PhaseBAiUsageEvidence,
): boolean {
  return (
    candidate.category === reconstructed.category &&
    candidate.outcome === reconstructed.outcome &&
    candidate.warningAtCents === reconstructed.warningAtCents &&
    candidate.optionalStopAtCents === reconstructed.optionalStopAtCents &&
    candidate.hardStopAtCents === reconstructed.hardStopAtCents &&
    candidate.tier === reconstructed.tier &&
    candidate.monthlyCents === reconstructed.monthlyCents
  );
}

/** Reconstructs one exact closed foundation result and rejects value drift. */
export function classifyPhaseBFoundationProbeEvidence(
  candidate: unknown,
): PhaseBFoundationProbeEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (
    !evidence ||
    !hasExactKeys(evidence, PHASE_B_FOUNDATION_KEYS) ||
    evidence.evidenceType !== "vision.phase-b-foundation-probe/v1" ||
    typeof evidence.roleMatches !== "boolean" ||
    typeof evidence.schemaMatches !== "boolean" ||
    typeof evidence.privilegesMatch !== "boolean" ||
    typeof evidence.protectedStorageMatches !== "boolean" ||
    typeof evidence.backupContractMatches !== "boolean" ||
    (evidence.sentinelStatus !== "passed" &&
      evidence.sentinelStatus !== "failed" &&
      evidence.sentinelStatus !== "not_tested") ||
    PHASE_B_FOUNDATION_INTEGER_KEYS.some(
      (key) =>
        typeof evidence[key] !== "number" ||
        !Number.isSafeInteger(evidence[key]) ||
        (evidence[key] as number) < 0,
    )
  ) {
    return null;
  }
  const measurements: PhaseBFoundationProbeMeasurements = {
    roleMatches: evidence.roleMatches,
    schemaMatches: evidence.schemaMatches,
    privilegesMatch: evidence.privilegesMatch,
    publicGrantCount: evidence.publicGrantCount as number,
    identityViolations: evidence.identityViolations as number,
    domainViolations: evidence.domainViolations as number,
    privacyViolations: evidence.privacyViolations as number,
    provenanceViolations: evidence.provenanceViolations as number,
    referenceViolations: evidence.referenceViolations as number,
    checkpointViolations: evidence.checkpointViolations as number,
    protectedStorageMatches: evidence.protectedStorageMatches,
    sentinelStatus: evidence.sentinelStatus,
    backupContractMatches: evidence.backupContractMatches,
    databaseBytes: evidence.databaseBytes as number,
    r2ObjectCount: evidence.r2ObjectCount as number,
    r2Bytes: evidence.r2Bytes as number,
  };
  let reconstructed: PhaseBFoundationProbeEvidence;
  const sourceCategory = evidence.category as
    | (typeof PHASE_B_FOUNDATION_SOURCE_CATEGORIES)[number]
    | undefined;
  if (
    sourceCategory !== undefined &&
    PHASE_B_FOUNDATION_SOURCE_CATEGORIES.includes(sourceCategory) &&
    evidence.outcome === "failed" &&
    isUnavailableFoundationMeasurements(measurements)
  ) {
    reconstructed = {
      evidenceType: "vision.phase-b-foundation-probe/v1",
      outcome: "failed",
      category: sourceCategory,
      ...measurements,
    };
  } else if (
    evidence.category === "numeric_bound_exceeded" &&
    evidence.outcome === "failed" &&
    PHASE_B_FOUNDATION_INTEGER_KEYS.some(
      (key) => measurements[key] === 0,
    )
  ) {
    reconstructed = {
      evidenceType: "vision.phase-b-foundation-probe/v1",
      outcome: "failed",
      category: "numeric_bound_exceeded",
      ...measurements,
    };
  } else {
    reconstructed = createPhaseBFoundationProbeEvidence(measurements);
    if (
      evidence.category !== reconstructed.category ||
      evidence.outcome !== reconstructed.outcome
    ) {
      return null;
    }
  }
  return Object.freeze({ ...reconstructed });
}

/** Reconstructs one coherent exact permanent maintenance result. */
export function classifyCalendarMaintenanceEvidence(
  candidate: unknown,
): CalendarMaintenanceEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (
    !evidence ||
    !hasExactKeys(evidence, CALENDAR_MAINTENANCE_KEYS) ||
    evidence.evidenceType !== "vision.calendar-maintenance/v2" ||
    !canonicalInstant(evidence.maintenanceScheduledAt)
  ) {
    return null;
  }
  const repairOutcome = evidence.repairOutcome;
  const renewalOutcome = evidence.renewalOutcome;
  if (
    repairOutcome !== "reserved" &&
    repairOutcome !== "no_work" &&
    repairOutcome !== "failed"
  ) {
    return null;
  }
  if (
    renewalOutcome !== "completed" &&
    renewalOutcome !== "no_work" &&
    renewalOutcome !== "failed"
  ) {
    return null;
  }
  const repairFailed = repairOutcome === "failed";
  const renewalFailed = renewalOutcome === "failed";
  const expectedOutcome = repairFailed || renewalFailed
    ? "failed"
    : "succeeded";
  const expectedCategory: CalendarMaintenanceEvidence["category"] =
    repairFailed && renewalFailed
      ? "repair_and_renewal_failed"
      : repairFailed
        ? "repair_failed"
        : renewalFailed
          ? "renewal_failed"
          : "none";
  if (
    evidence.outcome !== expectedOutcome ||
    evidence.category !== expectedCategory
  ) {
    return null;
  }
  return Object.freeze({
    category: expectedCategory,
    evidenceType: "vision.calendar-maintenance/v2",
    maintenanceScheduledAt: evidence.maintenanceScheduledAt as string,
    outcome: expectedOutcome,
    renewalOutcome,
    repairOutcome,
  });
}

/** Requires semantic acceptance success after exact structural classification. */
export function matchesPreviewAcceptanceExpectation(
  evidence: SafeTailResult,
  expectation: PreviewObserverAcceptanceExpectation,
): boolean {
  const candidate = snapshotOwnEnumerableData(evidence);
  if (!candidate) return false;
  switch (expectation.kind) {
    case "sync_suppressed":
      return (
        hasExactKeys(candidate, ["evidenceType", "outcome"] as const) &&
        candidate.evidenceType === "vision.sync-suppression/v1" &&
        candidate.outcome === "suppressed"
      );
    case "foundation_succeeded":
      return (
        candidate.evidenceType === "vision.phase-b-foundation-probe/v1" &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none"
      );
    case "fault_expected": {
      const expected = createTemporaryPreviewFaultEvidence(expectation.scenario);
      return JSON.stringify(candidate) === JSON.stringify(expected);
    }
    case "role_probe_succeeded":
      return (
        candidate.evidenceType === "vision.preview-role-probe/v1" &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none" &&
        candidate.roleMatches === true
      );
    case "restore_succeeded":
      return (
        candidate.evidenceType === "vision.preview-restore/v1" &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none"
      );
    case "maintenance_succeeded":
      return (
        candidate.evidenceType === "vision.calendar-maintenance/v2" &&
        candidate.maintenanceScheduledAt === expectation.maintenanceScheduledAt &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none" &&
        candidate.repairOutcome !== "failed" &&
        candidate.renewalOutcome !== "failed"
      );
    case "maintenance_repair_reserved":
      return (
        candidate.evidenceType === "vision.calendar-maintenance/v2" &&
        candidate.maintenanceScheduledAt === expectation.maintenanceScheduledAt &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none" &&
        candidate.repairOutcome === "reserved" &&
        candidate.renewalOutcome !== "failed"
      );
    case "ai_succeeded":
      return (
        candidate.evidenceType === "vision.ai-usage/v1" &&
        candidate.outcome === "succeeded" &&
        candidate.category === "none"
      );
  }
}

/** Locates one exact synchronization-suppression terminal. */
function locateSyncSuppressionEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: TemporarySyncSuppressionEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  let evidence: TemporarySyncSuppressionEvidence | null = null;
  let invalid = false;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      const body = snapshotOwnEnumerableData(message.evidence);
      const like =
        message.action === "acceptance.sync-suppression" ||
        body?.evidenceType === "vision.sync-suppression/v1";
      if (!like) continue;
      if (seen) invalid = true;
      seen = true;
      if (
        message.action !== "acceptance.sync-suppression" ||
        !hasExactKeys(message, ["action", "evidence"] as const) ||
        !body ||
        !hasExactKeys(body, ["evidenceType", "outcome"] as const) ||
        body.evidenceType !== "vision.sync-suppression/v1" ||
        body.outcome !== "suppressed"
      ) {
        invalid = true;
        continue;
      }
      evidence = Object.freeze({
        evidenceType: "vision.sync-suppression/v1",
        outcome: "suppressed",
      });
    }
  }
  return { seen, evidence: seen && !invalid ? evidence : null };
}

/** Recognizes one canonical millisecond UTC instant. */
function canonicalInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/** Reconstructs one exact closed role-probe result and rejects all shape or value drift. */
export function classifyTemporaryPreviewRoleProbeEvidence(
  candidate: unknown,
): TemporaryPreviewRoleProbeEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (
    !evidence ||
    !hasExactKeys(evidence, ROLE_PROBE_KEYS) ||
    evidence.evidenceType !== "vision.preview-role-probe/v1"
  ) {
    return null;
  }
  if (
    evidence.outcome === "succeeded" &&
    evidence.category === "none" &&
    evidence.roleMatches === true
  ) {
    return Object.freeze({
      category: "none",
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      roleMatches: true,
    });
  }
  if (
    evidence.outcome === "failed" &&
    typeof evidence.category === "string" &&
    ROLE_PROBE_FAILURE_CATEGORIES.includes(
      evidence.category as TemporaryPreviewRoleProbeFailureCategory,
    ) &&
    evidence.roleMatches === false
  ) {
    return Object.freeze({
      category:
        evidence.category as TemporaryPreviewRoleProbeFailureCategory,
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "failed",
      roleMatches: false,
    });
  }
  return null;
}

/** Reconstructs one exact closed restore result and rejects all shape or value drift. */
export function classifyTemporaryRestoreEvidence(
  candidate: unknown,
): TemporaryRestoreEvidence | null {
  const evidence = snapshotOwnEnumerableData(candidate);
  if (
    !evidence ||
    evidence.evidenceType !== "vision.preview-restore/v1"
  ) {
    return null;
  }
  if (evidence.outcome === "failed") {
    if (
      !hasExactKeys(evidence, RESTORE_FAILURE_KEYS) ||
      typeof evidence.category !== "string" ||
      !RESTORE_FAILURE_CATEGORIES.includes(
        evidence.category as TemporaryRestoreFailureCategory,
      )
    ) {
      return null;
    }
    return Object.freeze({
      evidenceType: "vision.preview-restore/v1",
      outcome: "failed",
      category: evidence.category as TemporaryRestoreFailureCategory,
    });
  }
  if (
    evidence.outcome !== "succeeded" ||
    !hasExactKeys(evidence, RESTORE_SUCCESS_KEYS) ||
    evidence.category !== "none" ||
    evidence.format !== "vision-backup/v1" ||
    evidence.schemaVersion !== 9 ||
    evidence.authoritativeTableCount !== BACKUP_TABLES.length ||
    !isPositiveSafeInteger(evidence.keyVersion) ||
    evidence.checksumMatches !== true ||
    evidence.referencesValid !== true ||
    evidence.targetWasEmpty !== true ||
    evidence.eventListReadable !== true ||
    !isNonnegativeSafeInteger(evidence.eventCount) ||
    evidence.replacedExisting !== false
  ) {
    return null;
  }
  const rowCounts = classifyRestoreRowCounts(evidence.rowCounts);
  if (!rowCounts) return null;
  return Object.freeze({
    evidenceType: "vision.preview-restore/v1",
    outcome: "succeeded",
    category: "none",
    format: "vision-backup/v1",
    schemaVersion: 9,
    keyVersion: evidence.keyVersion,
    authoritativeTableCount: BACKUP_TABLES.length,
    rowCounts,
    checksumMatches: true,
    referencesValid: true,
    targetWasEmpty: true,
    eventListReadable: true,
    eventCount: evidence.eventCount,
    replacedExisting: false,
  });
}

/** Maps Cloudflare outcomes to the closed evidence vocabulary. */
function normalizeOutcome(value: unknown): SafeTailEvidence["outcome"] {
  if (value === "ok" || value === "exception" || value === "canceled") {
    return value;
  }
  if (value === "exceededCpu") return "exceeded_cpu";
  return "unknown";
}

/** Finds the first exact restore log record without copying any other message. */
function locateTemporaryRestoreEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: TemporaryRestoreEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message) || log.message.length === 0) {
      continue;
    }
    const firstMessage = snapshotOwnEnumerableData(log.message[0]);
    if (!firstMessage || firstMessage.action !== "backup.restore") continue;
    seen = true;
    if (
      !hasExactKeys(firstMessage, ["action", "evidence"] as const)
    ) {
      continue;
    }
    const evidence = classifyTemporaryRestoreEvidence(firstMessage.evidence);
    if (evidence) return { seen: true, evidence };
  }
  return { seen, evidence: null };
}

/** Finds the first exact role-probe log record without copying any other message. */
function locateTemporaryPreviewRoleProbeEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: TemporaryPreviewRoleProbeEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message) || log.message.length === 0) {
      continue;
    }
    const firstMessage = snapshotOwnEnumerableData(log.message[0]);
    if (!firstMessage) continue;
    const candidateEvidence = snapshotOwnEnumerableData(
      firstMessage.evidence,
    );
    const roleProbeLike =
      candidateEvidence?.evidenceType ===
      "vision.preview-role-probe/v1";
    if (firstMessage.action !== "backup.restore-role-probe") {
      if (roleProbeLike) seen = true;
      continue;
    }
    seen = true;
    if (!hasExactKeys(firstMessage, ["action", "evidence"] as const)) {
      continue;
    }
    const evidence = classifyTemporaryPreviewRoleProbeEvidence(
      firstMessage.evidence,
    );
    if (evidence) return { seen: true, evidence };
  }
  return { seen, evidence: null };
}

/** Returns every terminal kind named by one action or evidence discriminator. */
function terminalKindsForMessage(
  message: Record<string, unknown>,
): ReadonlySet<TerminalKind> {
  const evidence = snapshotOwnEnumerableData(message.evidence);
  const kinds = new Set<TerminalKind>();
  for (const identity of TERMINAL_IDENTITIES) {
    if (
      message.action === identity.action ||
      evidence?.evidenceType === identity.evidenceType
    ) {
      kinds.add(identity.kind);
    }
  }
  return kinds;
}

/** Reports whether one message identifies the requested terminal kind. */
function hasTerminalKind(
  message: Record<string, unknown>,
  expected: TerminalKind,
): boolean {
  return terminalKindsForMessage(message).has(expected);
}

/** Reports whether one message identifies any different terminal kind. */
function hasOtherTerminalKind(
  message: Record<string, unknown>,
  expected: TerminalKind,
): boolean {
  for (const kind of terminalKindsForMessage(message)) {
    if (kind !== expected) return true;
  }
  return false;
}

/** Rejects cross-kind terminal evidence before locator order can select a winner. */
function hasMixedTerminalKinds(candidate: unknown): boolean {
  if (!Array.isArray(candidate)) return false;
  let observed: TerminalKind | null = null;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      for (const kind of terminalKindsForMessage(message)) {
        if (observed !== null && observed !== kind) return true;
        observed = kind;
      }
    }
  }
  return false;
}

/** Requires exactly one valid foundation terminal and rejects every mixed terminal. */
function locatePhaseBFoundationProbeEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: PhaseBFoundationProbeEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  let valid: PhaseBFoundationProbeEvidence | null = null;
  let invalid = false;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      const foundationLike = hasTerminalKind(
        message,
        "phase_b_foundation",
      );
      if (foundationLike) {
        if (seen) invalid = true;
        seen = true;
        if (
          message.action !== PHASE_B_FOUNDATION_PROBE_ACTION ||
          !hasExactKeys(message, ["action", "evidence"] as const)
        ) {
          invalid = true;
          continue;
        }
        const evidence = classifyPhaseBFoundationProbeEvidence(
          message.evidence,
        );
        if (!evidence || valid) {
          invalid = true;
          continue;
        }
        valid = evidence;
      } else if (hasOtherTerminalKind(message, "phase_b_foundation")) {
        invalid = true;
      }
    }
  }
  return {
    seen,
    evidence: seen && !invalid ? valid : null,
  };
}

/** Requires one exact AI terminal and rejects duplicate or mixed terminal records. */
function locatePhaseBAiUsageEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: PhaseBAiUsageEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  let invalid = false;
  let valid: PhaseBAiUsageEvidence | null = null;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      if (!hasTerminalKind(message, "phase_b_ai_usage")) {
        if (hasOtherTerminalKind(message, "phase_b_ai_usage")) {
          invalid = true;
        }
        continue;
      }
      if (seen) invalid = true;
      seen = true;
      if (
        message.action !== PHASE_B_AI_USAGE_ACTION ||
        !hasExactKeys(message, ["action", "evidence"] as const)
      ) {
        invalid = true;
        continue;
      }
      const evidence = classifyPhaseBAiUsageEvidence(message.evidence);
      if (!evidence || valid) {
        invalid = true;
        continue;
      }
      valid = evidence;
    }
  }
  return {
    seen,
    evidence: seen && !invalid ? valid : null,
  };
}

/** Requires one exact preview-fault terminal and rejects duplicate or mixed records. */
function locateTemporaryPreviewFaultEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: TemporaryPreviewFaultEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  let invalid = false;
  let valid: TemporaryPreviewFaultEvidence | null = null;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      if (!hasTerminalKind(message, "temporary_preview_fault")) {
        if (hasOtherTerminalKind(message, "temporary_preview_fault")) {
          invalid = true;
        }
        continue;
      }
      if (seen) invalid = true;
      seen = true;
      if (
        message.action !== TEMPORARY_PREVIEW_FAULT_ACTION ||
        !hasExactKeys(message, ["action", "evidence"] as const)
      ) {
        invalid = true;
        continue;
      }
      const evidence = classifyTemporaryPreviewFaultEvidence(message.evidence);
      if (!evidence || valid) {
        invalid = true;
        continue;
      }
      valid = evidence;
    }
  }
  return { seen, evidence: seen && !invalid ? valid : null };
}

/** Requires exactly one valid maintenance terminal record and no mixed terminal record. */
function locateCalendarMaintenanceEvidence(candidate: unknown): {
  readonly seen: boolean;
  readonly evidence: CalendarMaintenanceEvidence | null;
} {
  if (!Array.isArray(candidate)) return { seen: false, evidence: null };
  let seen = false;
  let valid: CalendarMaintenanceEvidence | null = null;
  let invalid = false;
  for (const logCandidate of candidate) {
    const log = snapshotOwnEnumerableData(logCandidate);
    if (!log || !Array.isArray(log.message)) continue;
    for (const messageCandidate of log.message) {
      const message = snapshotOwnEnumerableData(messageCandidate);
      if (!message) continue;
      const maintenanceLike = hasTerminalKind(
        message,
        "calendar_maintenance",
      );
      const mixedTerminal = hasOtherTerminalKind(
        message,
        "calendar_maintenance",
      );
      if (mixedTerminal) invalid = true;
      if (message.action !== "calendar.maintenance") {
        if (maintenanceLike) {
          seen = true;
          invalid = true;
        }
        continue;
      }
      if (seen) invalid = true;
      seen = true;
      if (!hasExactKeys(message, ["action", "evidence"] as const)) {
        invalid = true;
        continue;
      }
      const evidence = classifyCalendarMaintenanceEvidence(message.evidence);
      if (!evidence || valid) {
        invalid = true;
        continue;
      }
      valid = evidence;
    }
  }
  return {
    seen,
    evidence: seen && !invalid ? valid : null,
  };
}

/** Recognizes the one canonical source-unavailable measurement shape. */
function isUnavailableFoundationMeasurements(
  measurements: PhaseBFoundationProbeMeasurements,
): boolean {
  return (
    !measurements.roleMatches &&
    !measurements.schemaMatches &&
    !measurements.privilegesMatch &&
    measurements.publicGrantCount === 0 &&
    measurements.identityViolations === 0 &&
    measurements.domainViolations === 0 &&
    measurements.privacyViolations === 0 &&
    measurements.provenanceViolations === 0 &&
    measurements.referenceViolations === 0 &&
    measurements.checkpointViolations === 0 &&
    !measurements.protectedStorageMatches &&
    measurements.sentinelStatus === "not_tested" &&
    !measurements.backupContractMatches &&
    measurements.databaseBytes === 0 &&
    measurements.r2ObjectCount === 0 &&
    measurements.r2Bytes === 0
  );
}

/** Reconstructs all and only the authoritative nonnegative row counts. */
function classifyRestoreRowCounts(
  candidate: unknown,
): TemporaryRestoreEvidence["rowCounts"] | null {
  const counts = snapshotOwnEnumerableData(candidate);
  if (!counts || !hasExactKeys(counts, BACKUP_TABLES)) return null;
  const entries: Array<readonly [string, number]> = [];
  for (const table of BACKUP_TABLES) {
    const count = counts[table];
    if (!isNonnegativeSafeInteger(count)) return null;
    entries.push([table, count]);
  }
  return Object.freeze(
    Object.fromEntries(entries),
  ) as NonNullable<TemporaryRestoreEvidence["rowCounts"]>;
}

/** Finds only fixed recovery markers without serializing untrusted tail data. */
function findFailureMarker(
  candidate: unknown,
): SafeTailEvidence["category"] | undefined {
  const pending: unknown[] = [candidate];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === "string") {
      const marker = FAILURE_MARKERS.find(([message]) =>
        value.includes(message),
      );
      if (marker) return marker[1];
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (visited.has(value)) continue;
    visited.add(value);
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    const snapshot = snapshotOwnEnumerableData(value);
    if (snapshot) pending.push(...Object.values(snapshot));
  }
  return undefined;
}

/** Snapshots only own enumerable data properties without invoking accessors. */
function snapshotOwnEnumerableData(
  value: unknown,
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor?.enumerable ||
      typeof key !== "string" ||
      !("value" in descriptor)
    ) {
      return null;
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

/** Requires exactly one allowlisted enumerable key set. */
function hasExactKeys(
  candidate: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(candidate);
  return (
    keys.length === allowed.length &&
    allowed.every((key) => Object.prototype.hasOwnProperty.call(candidate, key))
  );
}

/** Recognizes one nonnegative safe-integer count. */
function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/** Recognizes one positive safe-integer key version. */
function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
