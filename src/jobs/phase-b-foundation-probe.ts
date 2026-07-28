/** Builds the closed privacy-safe evidence for the Phase B foundation probe. */
import {
  PhaseBFoundationProbeSourceError,
  type PhaseBFoundationProbeSource,
  type PhaseBFoundationProbeSourceFailureCategory,
} from "../data/phase-b-foundation-probe";

/** Exact deterministic terminal category vocabulary. */
export type PhaseBFoundationProbeCategory =
  | "none"
  | "configuration_invalid"
  | "database_unavailable"
  | "r2_unavailable"
  | "numeric_bound_exceeded"
  | "role_mismatch"
  | "schema_mismatch"
  | "privilege_mismatch"
  | "public_grants_present"
  | "identity_violation"
  | "domain_violation"
  | "privacy_violation"
  | "provenance_violation"
  | "reference_violation"
  | "checkpoint_violation"
  | "protected_storage_mismatch"
  | "sentinel_failed"
  | "backup_contract_mismatch";

/** Aggregate facts admitted from the read-only database and R2 source. */
export interface PhaseBFoundationProbeMeasurements {
  readonly roleMatches: boolean;
  readonly schemaMatches: boolean;
  readonly privilegesMatch: boolean;
  readonly publicGrantCount: number;
  readonly identityViolations: number;
  readonly domainViolations: number;
  readonly privacyViolations: number;
  readonly provenanceViolations: number;
  readonly referenceViolations: number;
  readonly checkpointViolations: number;
  readonly protectedStorageMatches: boolean;
  readonly sentinelStatus: "passed" | "failed" | "not_tested";
  readonly backupContractMatches: boolean;
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}

/** Exact terminal foundation-probe evidence contract. */
export interface PhaseBFoundationProbeEvidence
  extends PhaseBFoundationProbeMeasurements {
  readonly evidenceType: "vision.phase-b-foundation-probe/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category: PhaseBFoundationProbeCategory;
}

/** Injected read boundary keeps the job free of database and R2 capability. */
export type PhaseBFoundationProbeDependencies = Pick<
  PhaseBFoundationProbeSource,
  "read"
>;

/** The sole fixed action accepted by the safe-tail observer. */
export const PHASE_B_FOUNDATION_PROBE_ACTION =
  "acceptance.phase-b-foundation" as const;

const INTEGER_KEYS = [
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
] as const satisfies readonly (keyof PhaseBFoundationProbeMeasurements)[];

/** Constructs one deterministic record after admitting every integer. */
export function createPhaseBFoundationProbeEvidence(
  measurements: PhaseBFoundationProbeMeasurements,
): PhaseBFoundationProbeEvidence {
  let numericBoundExceeded = false;
  const admittedNumbers = Object.fromEntries(
    INTEGER_KEYS.map((key) => {
      const value = measurements[key];
      const admitted =
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0;
      if (!admitted) numericBoundExceeded = true;
      return [key, admitted ? value : 0];
    }),
  ) as Pick<
    PhaseBFoundationProbeMeasurements,
    (typeof INTEGER_KEYS)[number]
  >;
  const admitted: PhaseBFoundationProbeMeasurements = Object.freeze({
    roleMatches: measurements.roleMatches === true,
    schemaMatches: measurements.schemaMatches === true,
    privilegesMatch: measurements.privilegesMatch === true,
    ...admittedNumbers,
    protectedStorageMatches: measurements.protectedStorageMatches === true,
    sentinelStatus:
      measurements.sentinelStatus === "passed" ||
      measurements.sentinelStatus === "failed"
        ? measurements.sentinelStatus
        : "not_tested",
    backupContractMatches: measurements.backupContractMatches === true,
  });
  const category = numericBoundExceeded
    ? "numeric_bound_exceeded"
    : semanticCategory(admitted);
  return Object.freeze({
    evidenceType: "vision.phase-b-foundation-probe/v1",
    outcome: category === "none" ? "succeeded" : "failed",
    category,
    ...admitted,
  });
}

/** Runs one exact preview-only source and maps every failure to closed evidence. */
export async function runPhaseBFoundationProbe(
  environment: unknown,
  observedAt: Date,
  dependencies: PhaseBFoundationProbeDependencies,
): Promise<PhaseBFoundationProbeEvidence> {
  if (!isExactPreviewEnvironment(environment) || !isValidDate(observedAt)) {
    return unavailableEvidence("configuration_invalid");
  }
  try {
    return createPhaseBFoundationProbeEvidence(
      await dependencies.read(observedAt),
    );
  } catch (error) {
    if (error instanceof PhaseBFoundationProbeSourceError) {
      return unavailableEvidence(error.category);
    }
    return unavailableEvidence("database_unavailable");
  }
}

/** Emits only the fixed action and an already-closed evidence object. */
export function emitPhaseBFoundationProbeEvidence(
  evidence: PhaseBFoundationProbeEvidence,
  write: (entry: {
    readonly action: typeof PHASE_B_FOUNDATION_PROBE_ACTION;
    readonly evidence: PhaseBFoundationProbeEvidence;
  }) => void = console.info,
): void {
  write({ action: PHASE_B_FOUNDATION_PROBE_ACTION, evidence });
}

/** Selects the first semantic failure in the interface order from the plan. */
function semanticCategory(
  evidence: PhaseBFoundationProbeMeasurements,
): PhaseBFoundationProbeCategory {
  if (!evidence.roleMatches) return "role_mismatch";
  if (!evidence.schemaMatches) return "schema_mismatch";
  if (!evidence.privilegesMatch) return "privilege_mismatch";
  if (evidence.publicGrantCount !== 0) return "public_grants_present";
  if (evidence.identityViolations !== 0) return "identity_violation";
  if (evidence.domainViolations !== 0) return "domain_violation";
  if (evidence.privacyViolations !== 0) return "privacy_violation";
  if (evidence.provenanceViolations !== 0) return "provenance_violation";
  if (evidence.referenceViolations !== 0) return "reference_violation";
  if (evidence.checkpointViolations !== 0) return "checkpoint_violation";
  if (!evidence.protectedStorageMatches) {
    return "protected_storage_mismatch";
  }
  if (evidence.sentinelStatus !== "passed") return "sentinel_failed";
  if (!evidence.backupContractMatches) return "backup_contract_mismatch";
  return "none";
}

/** Creates the sole canonical unavailable/numeric failure shape. */
function unavailableEvidence(
  category:
    | PhaseBFoundationProbeSourceFailureCategory
    | "configuration_invalid",
): PhaseBFoundationProbeEvidence {
  return Object.freeze({
    evidenceType: "vision.phase-b-foundation-probe/v1",
    outcome: "failed",
    category,
    roleMatches: false,
    schemaMatches: false,
    privilegesMatch: false,
    publicGrantCount: 0,
    identityViolations: 0,
    domainViolations: 0,
    privacyViolations: 0,
    provenanceViolations: 0,
    referenceViolations: 0,
    checkpointViolations: 0,
    protectedStorageMatches: false,
    sentinelStatus: "not_tested",
    backupContractMatches: false,
    databaseBytes: 0,
    r2ObjectCount: 0,
    r2Bytes: 0,
  });
}

/** Requires the one-field preview boundary without retaining hostile properties. */
function isExactPreviewEnvironment(candidate: unknown): boolean {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate) ||
    Object.getPrototypeOf(candidate) !== Object.prototype
  ) {
    return false;
  }
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  const keys = Reflect.ownKeys(candidate);
  return (
    keys.length === 1 &&
    keys[0] === "VISION_ENV" &&
    descriptors.VISION_ENV?.enumerable === true &&
    "value" in descriptors.VISION_ENV &&
    descriptors.VISION_ENV.value === "preview"
  );
}

/** Admits only a real finite scheduler instant. */
function isValidDate(candidate: Date): boolean {
  return (
    candidate instanceof Date &&
    Number.isFinite(Date.prototype.getTime.call(candidate))
  );
}
