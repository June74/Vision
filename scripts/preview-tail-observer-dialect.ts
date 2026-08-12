/** Fixed, privacy-safe failure dialect shared by the tail observer and supervisor. */

/** The only observer failure categories admitted across the stderr boundary. */
export const PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES = Object.freeze([
  "invalid_configuration",
  "observer_window_invalid",
  "observer_no_matching_evidence",
  "rejected_terminal_event",
  "evidence_rejected_by_expectation",
  "maintenance_schedule_mismatch",
  "maintenance_outcome_mismatch",
  "maintenance_category_mismatch",
  "maintenance_repair_failure",
  "maintenance_renewal_failure",
  "maintenance_repair_not_reserved",
  "observer_uniqueness_failed",
  "observer_runtime_error",
  "input_closed_before_evidence",
] as const);

export type PreviewTailObserverFailureCategory =
  (typeof PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES)[number];

/** Maximum UTF-8 bytes inspected by the marker parser. */
export const PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES = 128;

const MARKER =
  /(?:^|\r?\n)Preview tail observer failed closed: ([a-z][a-z0-9_]{0,63})\.(?:\r?\n|$)/u;

/** Parses one bounded marker buffer without returning provider-controlled text. */
export function parsePreviewTailObserverFailureMarker(
  input: string,
): PreviewTailObserverFailureCategory | null {
  if (
    typeof input !== "string" ||
    Buffer.byteLength(input, "utf8") > PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES
  ) {
    return null;
  }
  const category = MARKER.exec(input)?.[1];
  if (!category) return null;
  return PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES.includes(
    category as PreviewTailObserverFailureCategory,
  )
    ? (category as PreviewTailObserverFailureCategory)
    : null;
}
