/** Resolves and emits the temporary preview-only synchronization suppression terminal. */
import {
  parseTemporaryPreviewAcceptanceSelector,
  type TemporaryPreviewAcceptanceSelector,
} from "../../domain/operations/temporary-preview-fault";

const CANONICAL_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const INVALID_CONFIGURATION =
  "Temporary synchronization suppression configuration is invalid.";

type TemporarySyncSuppressionBinding = {
  readonly PREVIEW_ACCEPTANCE_SCENARIO?: unknown;
  readonly PREVIEW_ACCEPTANCE_EXPIRES_AT?: unknown;
};

/** Closed runtime state for the temporary synchronization suppression selector. */
export type TemporarySyncSuppressionState =
  | "inactive"
  | "active"
  | "expired";

/** Content-free evidence emitted for one suppressed verified notification. */
export interface TemporarySyncSuppressionEvidence {
  readonly evidenceType: "vision.sync-suppression/v1";
  readonly outcome: "suppressed";
}

/** Exact terminal envelope admitted by the temporary observer. */
export interface TemporarySyncSuppressionEntry {
  readonly action: "acceptance.sync-suppression";
  readonly evidence: TemporarySyncSuppressionEvidence;
}

const SUPPRESSION_ENTRY: TemporarySyncSuppressionEntry = Object.freeze({
  action: "acceptance.sync-suppression",
  evidence: Object.freeze({
    evidenceType: "vision.sync-suppression/v1",
    outcome: "suppressed",
  }),
});

/** Resolves only an exact preview selector/expiry pair against the supplied clock. */
export function resolveTemporarySyncSuppressionState(
  now: Date,
  environment: unknown,
): TemporarySyncSuppressionState {
  const nowInstant = readDate(now);
  if (environment === null || typeof environment !== "object") {
    throw invalidConfiguration();
  }
  const binding = environment as TemporarySyncSuppressionBinding;
  const hasSelector = binding.PREVIEW_ACCEPTANCE_SCENARIO !== undefined;
  const hasExpiry = binding.PREVIEW_ACCEPTANCE_EXPIRES_AT !== undefined;
  if (!hasSelector && !hasExpiry) return "inactive";
  if (hasSelector !== hasExpiry) throw invalidConfiguration();

  let selector: TemporaryPreviewAcceptanceSelector | undefined;
  try {
    selector = parseTemporaryPreviewAcceptanceSelector(environment);
  } catch {
    throw invalidConfiguration();
  }
  const expiresAt = binding.PREVIEW_ACCEPTANCE_EXPIRES_AT;
  if (
    selector === undefined ||
    typeof expiresAt !== "string" ||
    !CANONICAL_INSTANT.test(expiresAt)
  ) {
    throw invalidConfiguration();
  }
  const expiryInstant = Date.parse(expiresAt);
  if (
    !Number.isFinite(expiryInstant) ||
    new Date(expiryInstant).toISOString() !== expiresAt
  ) {
    throw invalidConfiguration();
  }
  if (selector !== "sync_suppression") return "inactive";
  return expiryInstant > nowInstant ? "active" : "expired";
}

/** Emits one fixed deeply frozen terminal with no request or routing data. */
export function emitTemporarySyncSuppressionEvidence(
  write: (entry: TemporarySyncSuppressionEntry) => void = console.info,
): void {
  write(SUPPRESSION_ENTRY);
}

/** Reads only a genuine finite Date instant. */
function readDate(value: Date): number {
  try {
    const instant = Date.prototype.getTime.call(value);
    if (Number.isFinite(instant)) return instant;
  } catch {
    // Collapse every malformed clock into the same safe error.
  }
  throw invalidConfiguration();
}

/** Constructs the sole safe malformed-binding error. */
function invalidConfiguration(): Error {
  return new Error(INVALID_CONFIGURATION);
}
