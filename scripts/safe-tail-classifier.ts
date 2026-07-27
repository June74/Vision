/** Parses only closed recovery and temporary-restore evidence from Wrangler JSON. */
import { BACKUP_TABLES } from "../src/domain/backup/manifest";
import type {
  TemporaryRestoreEvidence,
  TemporaryRestoreFailureCategory,
} from "../src/jobs/temporary-preview-restore";

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

/** The only two evidence objects that the safe tail may emit. */
export type SafeTailResult = SafeTailEvidence | TemporaryRestoreEvidence;

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
const MAX_TAIL_EVENT_BYTES = 1_048_576;

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
  const cron =
    event.cron === "* * * * *"
      ? "temporary_recovery"
      : event.cron === "5 6 * * *"
        ? "daily_recovery"
        : null;
  if (!cron) return null;

  const restore = locateTemporaryRestoreEvidence(tail.logs);
  if (restore.evidence) {
    return cron === "temporary_recovery" ? restore.evidence : null;
  }
  if (restore.seen) return null;

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
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable) continue;
    if (typeof key !== "string" || !("value" in descriptor)) return null;
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
