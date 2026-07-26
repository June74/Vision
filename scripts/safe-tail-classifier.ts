/** Closed, privacy-safe evidence emitted from one Wrangler JSON tail line. */
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
const MAX_TAIL_EVENT_BYTES = 1_048_576;

/** Incrementally assembles Wrangler's pretty-printed JSON without emitting it. */
export function createSafeTailAccumulator(): {
  push(line: string): SafeTailEvidence | null;
} {
  let buffer = "";
  return Object.freeze({
    push(line: string): SafeTailEvidence | null {
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
export function classifySafeTailLine(line: string): SafeTailEvidence | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(candidate) || !isRecord(candidate.event)) return null;
  const cron =
    candidate.event.cron === "* * * * *"
      ? "temporary_recovery"
      : candidate.event.cron === "5 6 * * *"
        ? "daily_recovery"
        : null;
  if (!cron) return null;

  const serialized = JSON.stringify(candidate);
  const marker = FAILURE_MARKERS.find(([message]) =>
    serialized.includes(message),
  );
  const outcome = normalizeOutcome(candidate.outcome);
  return Object.freeze({
    category:
      marker?.[1] ??
      (outcome === "ok" ? "none" : "unknown_failure"),
    cron,
    outcome,
  });
}

function normalizeOutcome(value: unknown): SafeTailEvidence["outcome"] {
  if (value === "ok" || value === "exception" || value === "canceled") {
    return value;
  }
  if (value === "exceededCpu") return "exceeded_cpu";
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
