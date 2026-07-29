/** Enforces the privacy-safe cross-run lifecycle for preview candidate rollback. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INVALID = "Preview rollback lifecycle proof is invalid.";
const CANDIDATE_ARTIFACT_NAME = "vision-preview-candidate-intent";
const PREVIEW_WORKFLOW_PATH = ".github/workflows/preview.yml";
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const RUN_REF_PATTERN = /^(?:baseline|[1-9]\d{0,19})$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export interface PreviewCandidateIntent {
  readonly evidenceType: "vision.preview-candidate-intent/v1";
  readonly candidateCommit: string;
}

export interface PreviewRollbackRestoreProof {
  readonly evidenceType: "vision.preview-rollback-restored/v1";
  readonly candidateRunRefHash: string;
  readonly restoredCommit: string;
  readonly normalProviderState: "verified";
  readonly restoredAt: string;
  readonly providerVerifiedAt: string;
}

export interface PreviewRollbackClosureProof {
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

/** Creates the value-free marker uploaded before any candidate mutation. */
export function createPreviewCandidateIntent(
  candidateCommit: unknown,
): PreviewCandidateIntent {
  if (!validCommit(candidateCommit)) throw new Error(INVALID);
  return Object.freeze({
    evidenceType: "vision.preview-candidate-intent/v1",
    candidateCommit,
  });
}

/** Binds a downloaded candidate marker to the reviewed workflow commit. */
export function assertPreviewCandidateIntent(input: {
  readonly candidateIntent: unknown;
  readonly expectedCommit: unknown;
}): void {
  const intent = parseCandidateIntent(input.candidateIntent);
  if (
    intent === undefined ||
    !validCommit(input.expectedCommit) ||
    intent.candidateCommit !== input.expectedCommit
  ) {
    throw new Error(INVALID);
  }
}

/** Creates the normal-state proof only after the immutable rollback and provider check. */
export function createPreviewRollbackRestoreProof(input: {
  readonly candidateRunRef: unknown;
  readonly restoredCommit: unknown;
  readonly restoredAt: unknown;
  readonly providerVerifiedAt: unknown;
  readonly normalProviderState: unknown;
}): PreviewRollbackRestoreProof {
  if (
    !validRunRef(input.candidateRunRef) ||
    !validCommit(input.restoredCommit) ||
    input.normalProviderState !== "verified" ||
    !validInstant(input.restoredAt) ||
    !validInstant(input.providerVerifiedAt) ||
    Date.parse(input.providerVerifiedAt) <= Date.parse(input.restoredAt)
  ) {
    throw new Error(INVALID);
  }
  return Object.freeze({
    evidenceType: "vision.preview-rollback-restored/v1",
    candidateRunRefHash: hashCandidateRunRef(input.candidateRunRef),
    restoredCommit: input.restoredCommit,
    normalProviderState: "verified",
    restoredAt: input.restoredAt,
    providerVerifiedAt: input.providerVerifiedAt,
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
  return Object.freeze({
    evidenceType: "vision.preview-rollback-closed/v1",
    candidateRunRefHash: restored.candidateRunRefHash,
    restoredCommit: restored.restoredCommit,
    normalProviderState: "verified",
    authenticatedReads: "verified",
    restoreProofHash: digestRecord(restored),
    rollbackProviderVerifiedAt: restored.providerVerifiedAt,
    closureProviderVerifiedAt: input.closureProviderVerifiedAt,
    closedAt: input.closedAt,
  });
}

/** Blocks a later candidate or cleanup gate until the latest candidate is closed. */
export function assertPreviewRollbackClosure(input: {
  readonly closureProof: unknown;
  readonly latestCandidateRunRef: unknown;
  readonly expectedCommit: unknown;
  readonly operation: unknown;
}): void {
  if (
    input.closureProof === null &&
    input.latestCandidateRunRef === "baseline" &&
    validCommit(input.expectedCommit) &&
    input.operation === "candidate"
  ) {
    return;
  }
  const closure = parseClosureProof(input.closureProof);
  if (
    closure === undefined ||
    !validRunRef(input.latestCandidateRunRef) ||
    !validCommit(input.expectedCommit) ||
    (input.operation !== "candidate" && input.operation !== "cleanup") ||
    closure.candidateRunRefHash !==
      hashCandidateRunRef(input.latestCandidateRunRef) ||
    closure.restoredCommit !== input.expectedCommit ||
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
      !validInstant(createdAt) ||
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
    !validInstant(ownDataValue(run, "run_started_at")) ||
    !validInstant(ownDataValue(run, "updated_at")) ||
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
  const expectedKeys = [
    "candidateRunRefHash",
    "evidenceType",
    "normalProviderState",
    "providerVerifiedAt",
    "restoredAt",
    "restoredCommit",
  ];
  if (
    !exactKeys(record, expectedKeys) ||
    ownDataValue(record, "evidenceType") !==
      "vision.preview-rollback-restored/v1" ||
    !validDigest(ownDataValue(record, "candidateRunRefHash")) ||
    !validCommit(ownDataValue(record, "restoredCommit")) ||
    ownDataValue(record, "normalProviderState") !== "verified" ||
    !validInstant(ownDataValue(record, "restoredAt")) ||
    !validInstant(ownDataValue(record, "providerVerifiedAt")) ||
    Date.parse(ownDataValue(record, "providerVerifiedAt") as string) <=
      Date.parse(ownDataValue(record, "restoredAt") as string)
  ) {
    return undefined;
  }
  return record as unknown as PreviewRollbackRestoreProof;
}

/** Parses an exact pre-mutation candidate intent. */
function parseCandidateIntent(
  input: unknown,
): PreviewCandidateIntent | undefined {
  const record = plainObject(input);
  if (
    !exactKeys(record, ["candidateCommit", "evidenceType"]) ||
    ownDataValue(record, "evidenceType") !==
      "vision.preview-candidate-intent/v1" ||
    !validCommit(ownDataValue(record, "candidateCommit"))
  ) {
    return undefined;
  }
  return record as unknown as PreviewCandidateIntent;
}

/** Parses an exact post-restore closure proof. */
function parseClosureProof(
  input: unknown,
): PreviewRollbackClosureProof | undefined {
  const record = plainObject(input);
  const expectedKeys = [
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
  if (
    !exactKeys(record, expectedKeys) ||
    ownDataValue(record, "evidenceType") !==
      "vision.preview-rollback-closed/v1" ||
    !validDigest(ownDataValue(record, "candidateRunRefHash")) ||
    !validCommit(ownDataValue(record, "restoredCommit")) ||
    ownDataValue(record, "normalProviderState") !== "verified" ||
    ownDataValue(record, "authenticatedReads") !== "verified" ||
    !validDigest(ownDataValue(record, "restoreProofHash")) ||
    !validInstant(ownDataValue(record, "rollbackProviderVerifiedAt")) ||
    !validInstant(ownDataValue(record, "closureProviderVerifiedAt")) ||
    !validInstant(ownDataValue(record, "closedAt"))
  ) {
    return undefined;
  }
  return record as unknown as PreviewRollbackClosureProof;
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

/** Hashes a run reference before binding it into a lifecycle artifact. */
function hashCandidateRunRef(candidateRunRef: string): string {
  return createHash("sha256")
    .update("vision-preview-candidate-run/v1\0", "utf8")
    .update(candidateRunRef, "utf8")
    .digest("hex");
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
    if (mode === "--write-candidate-intent" && parsed.size === 2) {
      await writeJson(
        parsed.get("--output"),
        createPreviewCandidateIntent(parsed.get("--commit")),
      );
    } else if (mode === "--verify-candidate-intent" && parsed.size === 2) {
      assertPreviewCandidateIntent({
        candidateIntent: await readJson(parsed.get("--candidate-intent")),
        expectedCommit: parsed.get("--commit"),
      });
    } else if (mode === "--write-restore-proof" && parsed.size === 6) {
      await writeJson(
        parsed.get("--output"),
        createPreviewRollbackRestoreProof({
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
    } else if (mode === "--verify-closure" && parsed.size === 4) {
      assertPreviewRollbackClosure({
        closureProof: await readJson(parsed.get("--closure-proof")),
        latestCandidateRunRef: parsed.get("--candidate-run-ref"),
        expectedCommit: parsed.get("--commit"),
        operation: parsed.get("--operation"),
      });
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
    process.stdout.write("Preview rollback lifecycle proof is valid.\n");
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
