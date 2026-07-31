/** Enforces the privacy-safe cross-run lifecycle for preview candidate rollback. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INVALID = "Preview rollback lifecycle proof is invalid.";
const CANDIDATE_ARTIFACT_NAME = "vision-preview-candidate-intent";
const MUTATION_BOUNDARY_ARTIFACT_NAME =
  "vision-preview-candidate-mutation-boundary";
const PREVIEW_WORKFLOW_PATH = ".github/workflows/preview.yml";
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const RUN_REF_PATTERN = /^(?:baseline|[1-9]\d{0,19})$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const PROVIDER_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const CANDIDATE_OPERATIONS = [
  "deploy_foundation",
  "deploy_sync_suppression",
  "deploy_ai",
  "deploy_fault",
  "deploy_role_probe",
  "deploy_restore",
] as const;
type PreviewCandidateOperation = (typeof CANDIDATE_OPERATIONS)[number];
export type PreviewBindingProfile = "normal" | "restore_pair";
export type PreviewCandidateMutationState =
  | "not_started"
  | "may_have_started";

export interface PreviewCandidateAcceptanceBindings {
  readonly scenario: string;
  readonly expiresAt: string;
  readonly aiGatewayLimitAttested: "true" | null;
}

export interface LegacyPreviewCandidateIntent {
  readonly evidenceType: "vision.preview-candidate-intent/v1";
  readonly candidateCommit: string;
}

export interface PreviewCandidateIntentV2 {
  readonly evidenceType: "vision.preview-candidate-intent/v2";
  readonly candidateCommit: string;
  readonly candidateOperation: PreviewCandidateOperation;
  readonly bindingProfile: PreviewBindingProfile;
  readonly candidateConfigHash: string;
  readonly acceptanceBindings: PreviewCandidateAcceptanceBindings;
}
export type PreviewCandidateIntent =
  | LegacyPreviewCandidateIntent
  | PreviewCandidateIntentV2;

export type PreviewCandidateIntentDetails =
  | Readonly<{ readonly legacy: true }>
  | Readonly<{
      readonly legacy: false;
      readonly operation: PreviewCandidateOperation;
      readonly bindingProfile: PreviewBindingProfile;
      readonly acceptanceBindings: PreviewCandidateAcceptanceBindings;
    }>;

export interface PreviewCandidateMutationBoundary {
  readonly evidenceType: "vision.preview-candidate-mutation-boundary/v1";
  readonly candidateIntentHash: string;
  readonly candidateRunRefHash: string;
}

/** Derives the provider binding profile from an admitted operation. */
export function derivePreviewBindingProfile(
  operation: unknown,
): PreviewBindingProfile {
  if (operation === "deploy_role_probe" || operation === "deploy_restore") {
    return "restore_pair";
  }
  if (
    operation === "deploy_foundation" ||
    operation === "deploy_sync_suppression" ||
    operation === "deploy_ai" ||
    operation === "deploy_fault"
  ) {
    return "normal";
  }
  throw new Error(INVALID);
}

export interface LegacyPreviewRollbackRestoreProof {
  readonly evidenceType: "vision.preview-rollback-restored/v1";
  readonly candidateRunRefHash: string;
  readonly restoredCommit: string;
  readonly normalProviderState: "verified";
  readonly restoredAt: string;
  readonly providerVerifiedAt: string;
}

export interface PreviewRollbackRestoreProofV2 {
  readonly evidenceType: "vision.preview-rollback-restored/v2";
  readonly candidateRunRefHash: string;
  readonly candidateOperation: PreviewCandidateOperation;
  readonly bindingProfile: PreviewBindingProfile;
  readonly restoredCommit: string;
  readonly normalProviderState: "verified";
  readonly restoredAt: string;
  readonly providerVerifiedAt: string;
}
export type PreviewRollbackRestoreProof =
  | LegacyPreviewRollbackRestoreProof
  | PreviewRollbackRestoreProofV2;

export interface LegacyPreviewRollbackClosureProof {
  readonly evidenceType: "vision.preview-rollback-closed/v1";
  readonly candidateRunRefHash: string;
  readonly restoredCommit: string;
  readonly normalProviderState: "verified";
  readonly authenticatedReads: "verified";
  readonly restoreProofHash: string;
  readonly rollbackProviderVerifiedAt: string;
  readonly closureProviderVerifiedAt: string;
  readonly closedAt: string;
}

export interface PreviewRollbackClosureProofV2 {
  readonly evidenceType: "vision.preview-rollback-closed/v2";
  readonly candidateRunRefHash: string;
  readonly candidateOperation: PreviewCandidateOperation;
  readonly bindingProfile: PreviewBindingProfile;
  readonly restoredCommit: string;
  readonly normalProviderState: "verified";
  readonly authenticatedReads: "verified";
  readonly restoreProofHash: string;
  readonly rollbackProviderVerifiedAt: string;
  readonly closureProviderVerifiedAt: string;
  readonly closedAt: string;
}
export type PreviewRollbackClosureProof =
  | LegacyPreviewRollbackClosureProof
  | PreviewRollbackClosureProofV2;

/** Creates the value-free marker uploaded before any candidate mutation. */
export function createPreviewCandidateIntent(
  candidateCommit: unknown,
): PreviewCandidateIntentV2 {
  const candidateRecord = plainObject(candidateCommit);
  const commit = ownDataValue(candidateRecord, "candidateCommit");
  const operation = ownDataValue(candidateRecord, "operation");
  const candidateConfig = ownDataValue(candidateRecord, "candidateConfig");
  if (!validCommit(commit) || !validCandidateOperation(operation)) {
    throw new Error(INVALID);
  }
  const acceptanceBindings = readCandidateAcceptanceBindings(
    candidateConfig,
    operation,
  );
  return Object.freeze({
    evidenceType: "vision.preview-candidate-intent/v2",
    candidateCommit: commit,
    candidateOperation: operation,
    bindingProfile: derivePreviewBindingProfile(operation),
    candidateConfigHash: digestCanonicalValue(candidateConfig),
    acceptanceBindings,
  });
}

/** Arms the point after which a candidate deployment may have started. */
export function createPreviewCandidateMutationBoundary(input: {
  readonly candidateIntent: unknown;
  readonly candidateRunRef: unknown;
  readonly candidateConfig?: unknown;
}): PreviewCandidateMutationBoundary {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    intent.evidenceType !== "vision.preview-candidate-intent/v2" ||
    !validNumericRunRef(input.candidateRunRef) ||
    intent.candidateConfigHash !== digestCanonicalValue(input.candidateConfig)
  ) {
    throw new Error(INVALID);
  }
  return Object.freeze({
    evidenceType: "vision.preview-candidate-mutation-boundary/v1",
    candidateIntentHash: digestCandidateIntent(intent),
    candidateRunRefHash: hashCandidateRunRef(input.candidateRunRef),
  });
}

/** Rebinds a downloaded mutation boundary to its exact intent and run. */
export function assertPreviewCandidateMutationBoundary(input: {
  readonly candidateIntent: unknown;
  readonly mutationBoundary: unknown;
  readonly candidateRunRef: unknown;
  readonly expectedCommit: unknown;
  readonly candidateConfig?: unknown;
}): void {
  const intent = parseCandidateIntent(input.candidateIntent);
  const boundary = parseCandidateMutationBoundary(input.mutationBoundary);
  if (
    intent === undefined ||
    boundary === undefined ||
    !validNumericRunRef(input.candidateRunRef) ||
    !validCommit(input.expectedCommit) ||
    intent.candidateCommit !== input.expectedCommit ||
    intent.evidenceType !== "vision.preview-candidate-intent/v2" ||
    (input.candidateConfig !== undefined &&
      intent.candidateConfigHash !== digestCanonicalValue(input.candidateConfig)) ||
    boundary.candidateIntentHash !== digestCandidateIntent(intent) ||
    boundary.candidateRunRefHash !==
      hashCandidateRunRef(input.candidateRunRef)
  ) {
    throw new Error(INVALID);
  }
}

/** Distinguishes a proven pre-mutation failure from any uncertain deployment. */
export function readPreviewCandidateMutationState(input: {
  readonly candidateIntent: unknown;
  readonly artifactsResponse: unknown;
  readonly candidateRunRef: unknown;
}): PreviewCandidateMutationState {
  const intent = parseCandidateIntent(input.candidateIntent);
  const response = plainObject(input.artifactsResponse);
  const total = ownDataValue(response, "total_count");
  const artifacts = ownDataValue(response, "artifacts");
  if (
    intent === undefined ||
    response === undefined ||
    !validNumericRunRef(input.candidateRunRef) ||
    !Number.isSafeInteger(total) ||
    (total as number) < 0 ||
    !Array.isArray(artifacts) ||
    total !== artifacts.length ||
    artifacts.length > 1
  ) {
    throw new Error(INVALID);
  }
  if (artifacts.length === 0) {
    return intent.evidenceType === "vision.preview-candidate-intent/v1"
      ? "may_have_started"
      : "not_started";
  }
  if (intent.evidenceType !== "vision.preview-candidate-intent/v2") {
    throw new Error(INVALID);
  }

  const artifact = plainObject(artifacts[0]);
  const workflowRun = plainObject(ownDataValue(artifact, "workflow_run"));
  if (
    ownDataValue(artifact, "name") !== MUTATION_BOUNDARY_ARTIFACT_NAME ||
    ownDataValue(artifact, "expired") !== false ||
    ownDataValue(workflowRun, "id") !== Number(input.candidateRunRef)
  ) {
    throw new Error(INVALID);
  }
  return "may_have_started";
}

/** Binds a downloaded candidate marker to the reviewed workflow commit. */
export function assertPreviewCandidateIntent(input: {
  readonly candidateIntent: unknown;
  readonly expectedCommit: unknown;
  readonly nextOperation?: unknown;
}): void {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    !validCommit(input.expectedCommit) ||
    intent.candidateCommit !== input.expectedCommit ||
    (input.nextOperation !== undefined &&
      !allowedIntentTransition(intent, input.nextOperation))
  ) {
    throw new Error(INVALID);
  }
}

/** Returns only the closed profile re-derived from an exact candidate intent. */
export function readPreviewCandidateBindingProfile(input: {
  readonly candidateIntent: unknown;
  readonly expectedCommit: unknown;
}): PreviewBindingProfile {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    intent.evidenceType !== "vision.preview-candidate-intent/v2" ||
    !validCommit(input.expectedCommit) ||
    intent.candidateCommit !== input.expectedCommit
  ) {
    throw new Error(INVALID);
  }
  return derivePreviewBindingProfile(intent.candidateOperation);
}

/** Returns only validated provider-relevant intent data, never identifiers. */
export function readPreviewCandidateIntentDetails(input: {
  readonly candidateIntent: unknown;
  readonly expectedCommit: unknown;
}): PreviewCandidateIntentDetails {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    !validCommit(input.expectedCommit) ||
    intent.candidateCommit !== input.expectedCommit
  ) {
    throw new Error(INVALID);
  }
  return intent.evidenceType === "vision.preview-candidate-intent/v1"
    ? Object.freeze({ legacy: true as const })
    : Object.freeze({
        legacy: false as const,
        operation: intent.candidateOperation,
        bindingProfile: intent.bindingProfile,
        acceptanceBindings: intent.acceptanceBindings,
      });
}

/** Creates the normal-state proof only after the immutable rollback and provider check. */
export function createPreviewRollbackRestoreProof(input: {
  readonly candidateIntent: unknown;
  readonly candidateRunRef: unknown;
  readonly restoredCommit: unknown;
  readonly restoredAt: unknown;
  readonly providerVerifiedAt: unknown;
  readonly normalProviderState: unknown;
}): PreviewRollbackRestoreProof {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    !validRunRef(input.candidateRunRef) ||
    !validCommit(input.restoredCommit) ||
    intent.candidateCommit !== input.restoredCommit ||
    input.normalProviderState !== "verified" ||
    !validInstant(input.restoredAt) ||
    !validInstant(input.providerVerifiedAt) ||
    Date.parse(input.providerVerifiedAt) <= Date.parse(input.restoredAt)
  ) {
    throw new Error(INVALID);
  }
  const common = {
    candidateRunRefHash: hashCandidateRunRef(input.candidateRunRef),
    restoredCommit: input.restoredCommit,
    normalProviderState: "verified",
    restoredAt: input.restoredAt,
    providerVerifiedAt: input.providerVerifiedAt,
  } as const;
  return intent.evidenceType === "vision.preview-candidate-intent/v1"
    ? Object.freeze({
        evidenceType: "vision.preview-rollback-restored/v1" as const,
        ...common,
      })
    : Object.freeze({
        evidenceType: "vision.preview-rollback-restored/v2" as const,
        candidateOperation: intent.candidateOperation,
        bindingProfile: intent.bindingProfile,
        ...common,
      });
}

/**
 * Closes rollback only from a completed restore proof and a later, separately
 * dispatched authenticated-read attestation.
 */
export function closePreviewRollback(input: {
  readonly restoreProof: unknown;
  readonly candidateRunRef: unknown;
  readonly restoredCommit: unknown;
  readonly authenticatedReadsGate: unknown;
  readonly closureProviderVerifiedAt: unknown;
  readonly closedAt: unknown;
}): PreviewRollbackClosureProof {
  const restored = parseRestoreProof(input.restoreProof);
  if (
    restored === undefined ||
    !validRunRef(input.candidateRunRef) ||
    !validCommit(input.restoredCommit) ||
    input.authenticatedReadsGate !== "verified" ||
    !validInstant(input.closureProviderVerifiedAt) ||
    !validInstant(input.closedAt) ||
    restored.candidateRunRefHash !==
      hashCandidateRunRef(input.candidateRunRef) ||
    restored.restoredCommit !== input.restoredCommit ||
    Date.parse(input.closureProviderVerifiedAt) <=
      Date.parse(restored.providerVerifiedAt) ||
    Date.parse(input.closedAt) <=
      Date.parse(input.closureProviderVerifiedAt)
  ) {
    throw new Error(INVALID);
  }
  const common = {
    candidateRunRefHash: restored.candidateRunRefHash,
    restoredCommit: restored.restoredCommit,
    normalProviderState: "verified",
    authenticatedReads: "verified",
    restoreProofHash: digestRecord(restored),
    rollbackProviderVerifiedAt: restored.providerVerifiedAt,
    closureProviderVerifiedAt: input.closureProviderVerifiedAt,
    closedAt: input.closedAt,
  } as const;
  return restored.evidenceType === "vision.preview-rollback-restored/v1"
    ? Object.freeze({
        evidenceType: "vision.preview-rollback-closed/v1" as const,
        ...common,
      })
    : Object.freeze({
        evidenceType: "vision.preview-rollback-closed/v2" as const,
        candidateOperation: restored.candidateOperation,
        bindingProfile: restored.bindingProfile,
        ...common,
      });
}

/** Blocks a later candidate or cleanup gate until the latest candidate is closed. */
export function assertPreviewRollbackClosure(input: {
  readonly closureProof: unknown;
  readonly latestCandidateRunRef: unknown;
  readonly expectedCommit: unknown;
  readonly operation: unknown;
  readonly candidateIntent?: unknown;
}): void {
  if (
    input.closureProof === null &&
    input.latestCandidateRunRef === "baseline" &&
    validCommit(input.expectedCommit) &&
    (isNonRestoreCandidateOperation(input.operation) ||
      input.operation === "none")
  ) {
    return;
  }
  const closure = parseClosureProof(input.closureProof);
  const intent = input.candidateIntent === undefined
    ? undefined
    : parseCandidateIntent(input.candidateIntent);
  const candidateCommit = intent?.candidateCommit ?? input.expectedCommit;
  if (
    closure === undefined ||
    (input.candidateIntent !== undefined && intent === undefined) ||
    !validRunRef(input.latestCandidateRunRef) ||
    !validCommit(input.expectedCommit) ||
    !allowedClosureTransition(closure, intent, input.operation) ||
    closure.candidateRunRefHash !==
      hashCandidateRunRef(input.latestCandidateRunRef) ||
    closure.restoredCommit !== candidateCommit ||
    Date.parse(closure.closureProviderVerifiedAt) <=
      Date.parse(closure.rollbackProviderVerifiedAt) ||
    Date.parse(closure.closedAt) <=
      Date.parse(closure.closureProviderVerifiedAt)
  ) {
    throw new Error(INVALID);
  }
}

/** Selects only the newest unexpired candidate artifact; zero means baseline. */
export function readLatestPreviewCandidateRunRef(input: unknown): string {
  const response = plainObject(input);
  const total = ownDataValue(response, "total_count");
  const artifacts = ownDataValue(response, "artifacts");
  if (
    response === undefined ||
    !Number.isSafeInteger(total) ||
    (total as number) < 0 ||
    !Array.isArray(artifacts) ||
    total !== artifacts.length
  ) {
    throw new Error(INVALID);
  }
  if (artifacts.length === 0) return "baseline";

  const admitted = artifacts.map((artifact) => {
    const record = plainObject(artifact);
    const workflowRun = plainObject(ownDataValue(record, "workflow_run"));
    const name = ownDataValue(record, "name");
    const expired = ownDataValue(record, "expired");
    const createdAt = ownDataValue(record, "created_at");
    const runId = ownDataValue(workflowRun, "id");
    if (
      name !== CANDIDATE_ARTIFACT_NAME ||
      expired !== false ||
      !validProviderInstant(createdAt) ||
      !Number.isSafeInteger(runId) ||
      (runId as number) < 1
    ) {
      throw new Error(INVALID);
    }
    return {
      createdAt: Date.parse(createdAt as string),
      runRef: String(runId),
    };
  });
  admitted.sort(
    (left, right) =>
      right.createdAt - left.createdAt ||
      Number(right.runRef) - Number(left.runRef),
  );
  return admitted[0]!.runRef;
}

/** Proves one exact rollback or closure job completed successfully at the commit. */
export function validateCompletedPreviewLifecycleRun(input: {
  readonly run: unknown;
  readonly jobs: unknown;
  readonly expectedCommit: unknown;
  readonly expectedJobName: unknown;
}): void {
  const run = plainObject(input.run);
  const jobsResponse = plainObject(input.jobs);
  const jobs = ownDataValue(jobsResponse, "jobs");
  const path = ownDataValue(run, "path");
  if (
    run === undefined ||
    !validCommit(input.expectedCommit) ||
    typeof input.expectedJobName !== "string" ||
    input.expectedJobName.length < 1 ||
    ownDataValue(run, "event") !== "workflow_dispatch" ||
    ownDataValue(run, "status") !== "completed" ||
    ownDataValue(run, "conclusion") !== "success" ||
    ownDataValue(run, "head_sha") !== input.expectedCommit ||
    (path !== PREVIEW_WORKFLOW_PATH &&
      !(
        typeof path === "string" &&
        path.startsWith(`${PREVIEW_WORKFLOW_PATH}@refs/`)
      )) ||
    !validProviderInstant(ownDataValue(run, "run_started_at")) ||
    !validProviderInstant(ownDataValue(run, "updated_at")) ||
    Date.parse(ownDataValue(run, "updated_at") as string) <
      Date.parse(ownDataValue(run, "run_started_at") as string) ||
    !Array.isArray(jobs)
  ) {
    throw new Error(INVALID);
  }
  const matchingJobs = jobs.filter((job) => {
    const record = plainObject(job);
    return ownDataValue(record, "name") === input.expectedJobName;
  });
  if (
    matchingJobs.length !== 1 ||
    ownDataValue(plainObject(matchingJobs[0]), "status") !== "completed" ||
    ownDataValue(plainObject(matchingJobs[0]), "conclusion") !== "success"
  ) {
    throw new Error(INVALID);
  }
}

/** Parses an exact restored-normal proof without invoking untrusted accessors. */
function parseRestoreProof(
  input: unknown,
): PreviewRollbackRestoreProof | undefined {
  const record = plainObject(input);
  const legacyKeys = [
    "candidateRunRefHash",
    "evidenceType",
    "normalProviderState",
    "providerVerifiedAt",
    "restoredAt",
    "restoredCommit",
  ];
  const version = ownDataValue(record, "evidenceType");
  if (version === "vision.preview-rollback-restored/v1") {
    return exactKeys(record, legacyKeys) &&
        validRestoreProofCommon(record)
      ? record as unknown as LegacyPreviewRollbackRestoreProof
      : undefined;
  }
  const v2Keys = [
    "bindingProfile",
    "candidateOperation",
    "candidateRunRefHash",
    "evidenceType",
    "normalProviderState",
    "providerVerifiedAt",
    "restoredAt",
    "restoredCommit",
  ];
  if (
    version !== "vision.preview-rollback-restored/v2" ||
    !exactKeys(record, v2Keys) ||
    !validCandidateOperation(ownDataValue(record, "candidateOperation")) ||
    derivePreviewBindingProfile(ownDataValue(record, "candidateOperation")) !==
      ownDataValue(record, "bindingProfile") ||
    !validRestoreProofCommon(record)
  ) {
    return undefined;
  }
  return record as unknown as PreviewRollbackRestoreProofV2;
}

/** Validates the fields shared by both restore-proof schema generations. */
function validRestoreProofCommon(
  record: Record<string, unknown> | undefined,
): boolean {
  return validDigest(ownDataValue(record, "candidateRunRefHash")) &&
    validCommit(ownDataValue(record, "restoredCommit")) &&
    ownDataValue(record, "normalProviderState") === "verified" &&
    validInstant(ownDataValue(record, "restoredAt")) &&
    validInstant(ownDataValue(record, "providerVerifiedAt")) &&
    Date.parse(ownDataValue(record, "providerVerifiedAt") as string) >
      Date.parse(ownDataValue(record, "restoredAt") as string);
}

/** Parses an exact pre-mutation candidate intent. */
function parseCandidateIntent(
  input: unknown,
): PreviewCandidateIntent | undefined {
  const record = plainObject(input);
  const version = ownDataValue(record, "evidenceType");
  if (version === "vision.preview-candidate-intent/v1") {
    return exactKeys(record, ["candidateCommit", "evidenceType"]) &&
        validCommit(ownDataValue(record, "candidateCommit"))
      ? record as unknown as LegacyPreviewCandidateIntent
      : undefined;
  }
  if (
    !exactKeys(record, [
      "acceptanceBindings",
      "bindingProfile",
      "candidateCommit",
      "candidateConfigHash",
      "candidateOperation",
      "evidenceType",
    ]) ||
    version !== "vision.preview-candidate-intent/v2" ||
    !validCommit(ownDataValue(record, "candidateCommit")) ||
    !validDigest(ownDataValue(record, "candidateConfigHash")) ||
    !validCandidateOperation(ownDataValue(record, "candidateOperation"))
  ) {
    return undefined;
  }
  try {
    if (
      derivePreviewBindingProfile(
        ownDataValue(record, "candidateOperation"),
      ) !== ownDataValue(record, "bindingProfile") ||
      !validAcceptanceBindings(
        ownDataValue(record, "acceptanceBindings"),
        ownDataValue(record, "candidateOperation") as PreviewCandidateOperation,
      )
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return record as unknown as PreviewCandidateIntentV2;
}

/** Parses one exact immutable marker for the may-mutate boundary. */
function parseCandidateMutationBoundary(
  input: unknown,
): PreviewCandidateMutationBoundary | undefined {
  const record = plainObject(input);
  if (
    !exactKeys(record, [
      "candidateIntentHash",
      "candidateRunRefHash",
      "evidenceType",
    ]) ||
    ownDataValue(record, "evidenceType") !==
      "vision.preview-candidate-mutation-boundary/v1" ||
    !validDigest(ownDataValue(record, "candidateIntentHash")) ||
    !validDigest(ownDataValue(record, "candidateRunRefHash"))
  ) {
    return undefined;
  }
  return record as unknown as PreviewCandidateMutationBoundary;
}

/** Enforces the only same-commit follow-on transitions. */
function allowedCandidateTransition(
  candidateOperation: PreviewCandidateOperation,
  nextOperation: unknown,
): boolean {
  if (candidateOperation === "deploy_role_probe") {
    return (
      nextOperation === "deploy_restore" ||
      nextOperation === "verify_cleanup"
    );
  }
  if (candidateOperation === "deploy_restore") {
    return nextOperation === "verify_cleanup";
  }
  return (
    derivePreviewBindingProfile(candidateOperation) === "normal" &&
    (nextOperation === "verify_cleanup" ||
      isNonRestoreCandidateOperation(nextOperation))
  );
}

/** Applies the explicit legacy recovery policy without inventing provenance. */
function allowedIntentTransition(
  intent: PreviewCandidateIntent,
  nextOperation: unknown,
): boolean {
  return intent.evidenceType === "vision.preview-candidate-intent/v1"
    ? nextOperation === "verify_cleanup" ||
      isNonRestoreCandidateOperation(nextOperation)
    : allowedCandidateTransition(intent.candidateOperation, nextOperation);
}

/** Separates closure provenance from the commit being newly deployed. */
function allowedClosureTransition(
  closure: PreviewRollbackClosureProof,
  intent: PreviewCandidateIntent | undefined,
  operation: unknown,
): boolean {
  if (operation === "none") return true;
  if (closure.evidenceType === "vision.preview-rollback-closed/v1") {
    return operation === "verify_cleanup" ||
      isNonRestoreCandidateOperation(operation);
  }
  if (
    intent !== undefined &&
    (intent.evidenceType !== "vision.preview-candidate-intent/v2" ||
      intent.candidateOperation !== closure.candidateOperation ||
      intent.bindingProfile !== closure.bindingProfile)
  ) {
    return false;
  }
  return allowedCandidateTransition(closure.candidateOperation, operation);
}

/** Allows normal candidates and the role probe, but never direct restore. */
function isNonRestoreCandidateOperation(
  value: unknown,
): value is Exclude<PreviewCandidateOperation, "deploy_restore"> {
  return validCandidateOperation(value) && value !== "deploy_restore";
}

/** Rejects aliases and non-string values at every transition boundary. */
function validCandidateOperation(
  value: unknown,
): value is PreviewCandidateOperation {
  return CANDIDATE_OPERATIONS.some((operation) => operation === value);
}

/** Narrows unknown workflow input without string coercion. */
function isCandidateOperation(
  value: unknown,
): value is PreviewCandidateOperation {
  return validCandidateOperation(value);
}

/** Parses an exact post-restore closure proof. */
function parseClosureProof(
  input: unknown,
): PreviewRollbackClosureProof | undefined {
  const record = plainObject(input);
  const legacyKeys = [
    "authenticatedReads",
    "candidateRunRefHash",
    "closedAt",
    "closureProviderVerifiedAt",
    "evidenceType",
    "normalProviderState",
    "restoreProofHash",
    "restoredCommit",
    "rollbackProviderVerifiedAt",
  ];
  const version = ownDataValue(record, "evidenceType");
  if (version === "vision.preview-rollback-closed/v1") {
    return exactKeys(record, legacyKeys) && validClosureProofCommon(record)
      ? record as unknown as LegacyPreviewRollbackClosureProof
      : undefined;
  }
  const v2Keys = [
    "authenticatedReads",
    "bindingProfile",
    "candidateOperation",
    "candidateRunRefHash",
    "closedAt",
    "closureProviderVerifiedAt",
    "evidenceType",
    "normalProviderState",
    "restoreProofHash",
    "restoredCommit",
    "rollbackProviderVerifiedAt",
  ];
  if (
    version !== "vision.preview-rollback-closed/v2" ||
    !exactKeys(record, v2Keys) ||
    !validCandidateOperation(ownDataValue(record, "candidateOperation")) ||
    derivePreviewBindingProfile(ownDataValue(record, "candidateOperation")) !==
      ownDataValue(record, "bindingProfile") ||
    !validClosureProofCommon(record)
  ) {
    return undefined;
  }
  return record as unknown as PreviewRollbackClosureProofV2;
}

/** Validates the fields shared by both closure-proof schema generations. */
function validClosureProofCommon(
  record: Record<string, unknown> | undefined,
): boolean {
  return validDigest(ownDataValue(record, "candidateRunRefHash")) &&
    validCommit(ownDataValue(record, "restoredCommit")) &&
    ownDataValue(record, "normalProviderState") === "verified" &&
    ownDataValue(record, "authenticatedReads") === "verified" &&
    validDigest(ownDataValue(record, "restoreProofHash")) &&
    validInstant(ownDataValue(record, "rollbackProviderVerifiedAt")) &&
    validInstant(ownDataValue(record, "closureProviderVerifiedAt")) &&
    validInstant(ownDataValue(record, "closedAt"));
}

/** Requires one exact own enumerable string-key inventory. */
function exactKeys(
  record: Record<string, unknown> | undefined,
  expected: readonly string[],
): boolean {
  if (record === undefined) return false;
  const keys = Reflect.ownKeys(record);
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key) => typeof key === "string") &&
    Object.keys(record)
      .sort()
      .every((key, index) => key === sortedExpected[index]) &&
    sortedExpected.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      return descriptor?.enumerable === true && "value" in descriptor;
    })
  );
}

/** Reads one own enumerable data property without invoking accessors. */
function ownDataValue(
  record: Record<string, unknown> | undefined,
  key: string,
): unknown {
  if (record === undefined) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

/** Admits only ordinary data objects with the default object prototype. */
function plainObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? value as Record<string, unknown>
    : undefined;
}

/** Accepts only a complete lowercase commit digest. */
function validCommit(value: unknown): value is string {
  return typeof value === "string" && SHA_PATTERN.test(value);
}

/** Accepts only a positive decimal workflow-run reference. */
function validRunRef(value: unknown): value is string {
  return typeof value === "string" && RUN_REF_PATTERN.test(value);
}

/** Accepts only a non-baseline workflow-run reference. */
function validNumericRunRef(value: unknown): value is string {
  return validRunRef(value) && value !== "baseline";
}

/** Accepts only a complete lowercase SHA-256 digest. */
function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

/** Accepts only a canonical UTC millisecond instant. */
function validInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

/** Accepts GitHub's canonical whole-second UTC metadata timestamps. */
function validProviderInstant(value: unknown): value is string {
  if (typeof value !== "string" || !PROVIDER_INSTANT_PATTERN.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().replace(".000Z", "Z") === value;
}

/** Reads the exact temporary acceptance values generated for one operation. */
function readCandidateAcceptanceBindings(
  candidateConfig: unknown,
  operation: PreviewCandidateOperation,
): PreviewCandidateAcceptanceBindings {
  const config = plainObject(candidateConfig);
  const vars = plainObject(ownDataValue(config, "vars"));
  const scenario = ownDataValue(vars, "PREVIEW_ACCEPTANCE_SCENARIO");
  const expiresAt = ownDataValue(vars, "PREVIEW_ACCEPTANCE_EXPIRES_AT");
  const aiAttestation = ownDataValue(
    vars,
    "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
  );
  const expectedScenario = operation === "deploy_foundation"
    ? "foundation_probe"
    : operation === "deploy_sync_suppression"
      ? "sync_suppression"
      : operation === "deploy_ai"
        ? "ai_usage"
        : operation === "deploy_role_probe"
          ? "role_probe"
          : operation === "deploy_restore"
            ? "restore"
            : undefined;
  const validFaultScenario = operation === "deploy_fault" &&
    (scenario === "queue_delayed" ||
      scenario === "job_failed" ||
      scenario === "channel_expired" ||
      scenario === "database_unavailable" ||
      scenario === "r2_upload_failed" ||
      scenario === "ai_stopped");
  if (
    vars === undefined ||
    (!validFaultScenario && scenario !== expectedScenario) ||
    !validInstant(expiresAt) ||
    (operation === "deploy_ai"
      ? aiAttestation !== "true"
      : Object.prototype.hasOwnProperty.call(
          vars,
          "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
        ))
  ) {
    throw new Error(INVALID);
  }
  return Object.freeze({
    scenario: scenario as string,
    expiresAt,
    aiGatewayLimitAttested: operation === "deploy_ai" ? "true" : null,
  });
}

/** Revalidates the immutable acceptance values embedded in a v2 intent. */
function validAcceptanceBindings(
  value: unknown,
  operation: PreviewCandidateOperation,
): boolean {
  const record = plainObject(value);
  if (
    !exactKeys(record, ["aiGatewayLimitAttested", "expiresAt", "scenario"])
  ) {
    return false;
  }
  try {
    const vars = {
      PREVIEW_ACCEPTANCE_SCENARIO: ownDataValue(record, "scenario"),
      PREVIEW_ACCEPTANCE_EXPIRES_AT: ownDataValue(record, "expiresAt"),
      ...(ownDataValue(record, "aiGatewayLimitAttested") === "true"
        ? { PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true" }
        : {}),
    };
    const parsed = readCandidateAcceptanceBindings({ vars }, operation);
    return ownDataValue(record, "aiGatewayLimitAttested") ===
      parsed.aiGatewayLimitAttested;
  } catch {
    return false;
  }
}

/** Hashes one accessor-free JSON value after recursively sorting object keys. */
function digestCanonicalValue(value: unknown): string {
  const canonical = canonicalizeJson(value, 0);
  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}

/** Builds a deterministic JSON value without invoking caller-owned accessors. */
function canonicalizeJson(value: unknown, depth: number): unknown {
  if (depth > 32) throw new Error(INVALID);
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(INVALID);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry, depth + 1));
  }
  const record = plainObject(value);
  if (record === undefined) throw new Error(INVALID);
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => typeof key !== "string")) throw new Error(INVALID);
  const canonical: Record<string, unknown> = {};
  for (const key of (keys as string[]).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new Error(INVALID);
    }
    canonical[key] = canonicalizeJson(descriptor.value, depth + 1);
  }
  return canonical;
}

/** Hashes a run reference before binding it into a lifecycle artifact. */
function hashCandidateRunRef(candidateRunRef: string): string {
  return createHash("sha256")
    .update("vision-preview-candidate-run/v1\0", "utf8")
    .update(candidateRunRef, "utf8")
    .digest("hex");
}

/** Hashes the canonical immutable candidate intent. */
function digestCandidateIntent(intent: PreviewCandidateIntent): string {
  return digestCanonicalValue(intent);
}

/** Produces the deterministic digest used by the closure transition. */
function digestRecord(record: PreviewRollbackRestoreProof): string {
  return createHash("sha256")
    .update(JSON.stringify(record), "utf8")
    .digest("hex");
}

/** Parses unique named flag pairs without aliases or positional values. */
function readPairs(arguments_: readonly string[]): ReadonlyMap<string, string> {
  if (arguments_.length === 0 || arguments_.length % 2 !== 0) {
    throw new Error(INVALID);
  }
  const parsed = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (
      name === undefined ||
      value === undefined ||
      !name.startsWith("--") ||
      value.startsWith("--") ||
      parsed.has(name)
    ) {
      throw new Error(INVALID);
    }
    parsed.set(name, value);
  }
  return parsed;
}

/** Reads one required JSON artifact without exposing its content. */
async function readJson(path: string | undefined): Promise<unknown> {
  if (path === undefined) throw new Error(INVALID);
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

/** Exclusively creates one lifecycle artifact as canonical formatted JSON. */
async function writeJson(path: string | undefined, value: unknown): Promise<void> {
  if (path === undefined) throw new Error(INVALID);
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

/** Executes only closed file-based transitions without rendering identifiers. */
async function main(): Promise<void> {
  try {
    const [mode, ...rest] = process.argv.slice(2);
    const parsed = readPairs(rest);
    let successOutput = "Preview rollback lifecycle proof is valid.\n";
    if (mode === "--write-candidate-intent" && parsed.size === 4) {
      await writeJson(
        parsed.get("--output"),
        createPreviewCandidateIntent({
          candidateCommit: parsed.get("--commit"),
          operation: parsed.get("--operation"),
          candidateConfig: await readJson(parsed.get("--candidate-config")),
        }),
      );
    } else if (
      mode === "--verify-candidate-intent" &&
      (parsed.size === 2 || parsed.size === 3)
    ) {
      assertPreviewCandidateIntent({
        candidateIntent: await readJson(parsed.get("--candidate-intent")),
        expectedCommit: parsed.get("--commit"),
        ...(parsed.has("--next-operation")
          ? { nextOperation: parsed.get("--next-operation") }
          : {}),
      });
    } else if (
      mode === "--write-mutation-boundary" &&
      parsed.size === 4
    ) {
      await writeJson(
        parsed.get("--output"),
        createPreviewCandidateMutationBoundary({
          candidateIntent: await readJson(parsed.get("--candidate-intent")),
          candidateRunRef: parsed.get("--candidate-run-ref"),
          candidateConfig: await readJson(parsed.get("--candidate-config")),
        }),
      );
    } else if (
      mode === "--classify-mutation-artifacts" &&
      parsed.size === 3
    ) {
      successOutput = `${readPreviewCandidateMutationState({
        candidateIntent: await readJson(parsed.get("--candidate-intent")),
        artifactsResponse: await readJson(parsed.get("--artifacts-file")),
        candidateRunRef: parsed.get("--candidate-run-ref"),
      })}\n`;
    } else if (
      mode === "--verify-mutation-boundary" &&
      (parsed.size === 4 || parsed.size === 5)
    ) {
      assertPreviewCandidateMutationBoundary({
        candidateIntent: await readJson(parsed.get("--candidate-intent")),
        mutationBoundary: await readJson(parsed.get("--mutation-boundary")),
        candidateRunRef: parsed.get("--candidate-run-ref"),
        expectedCommit: parsed.get("--commit"),
        ...(parsed.has("--candidate-config")
          ? {
              candidateConfig: await readJson(
                parsed.get("--candidate-config"),
              ),
            }
          : {}),
      });
    } else if (mode === "--write-restore-proof" && parsed.size === 7) {
      await writeJson(
        parsed.get("--output"),
        createPreviewRollbackRestoreProof({
          candidateIntent: await readJson(parsed.get("--candidate-intent")),
          candidateRunRef: parsed.get("--candidate-run-ref"),
          restoredCommit: parsed.get("--commit"),
          restoredAt: parsed.get("--restored-at"),
          providerVerifiedAt: parsed.get("--provider-verified-at"),
          normalProviderState: parsed.get("--provider-state"),
        }),
      );
    } else if (mode === "--close-rollback" && parsed.size === 7) {
      await writeJson(
        parsed.get("--output"),
        closePreviewRollback({
          restoreProof: await readJson(parsed.get("--restore-proof")),
          candidateRunRef: parsed.get("--candidate-run-ref"),
          restoredCommit: parsed.get("--commit"),
          authenticatedReadsGate: parsed.get("--authenticated-reads-gate"),
          closureProviderVerifiedAt: parsed.get(
            "--closure-provider-verified-at",
          ),
          closedAt: parsed.get("--closed-at"),
        }),
      );
    } else if (
      mode === "--verify-closure" &&
      (parsed.size === 4 || parsed.size === 5)
    ) {
      assertPreviewRollbackClosure({
        closureProof: await readJson(parsed.get("--closure-proof")),
        latestCandidateRunRef: parsed.get("--candidate-run-ref"),
        expectedCommit: parsed.get("--commit"),
        operation: parsed.get("--operation"),
        ...(parsed.has("--candidate-intent")
          ? {
              candidateIntent: await readJson(
                parsed.get("--candidate-intent"),
              ),
            }
          : {}),
      });
    } else if (mode === "--read-candidate-commit" && parsed.size === 1) {
      const intent = parseCandidateIntent(
        await readJson(parsed.get("--candidate-intent")),
      );
      if (intent === undefined) throw new Error(INVALID);
      successOutput = `${intent.candidateCommit}\n`;
    } else if (mode === "--verify-latest-candidate" && parsed.size === 2) {
      const latest = readLatestPreviewCandidateRunRef(
        await readJson(parsed.get("--artifacts-file")),
      );
      if (latest !== parsed.get("--candidate-run-ref")) throw new Error(INVALID);
    } else if (mode === "--verify-run" && parsed.size === 4) {
      validateCompletedPreviewLifecycleRun({
        run: await readJson(parsed.get("--run-file")),
        jobs: await readJson(parsed.get("--jobs-file")),
        expectedCommit: parsed.get("--commit"),
        expectedJobName: parsed.get("--job-name"),
      });
    } else {
      throw new Error(INVALID);
    }
    process.stdout.write(successOutput);
  } catch {
    process.stderr.write(`${INVALID}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
