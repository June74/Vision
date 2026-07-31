/** Builds one reviewed preview-only acceptance artifact from the normal build output. */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS,
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  type TemporaryPreviewAcceptanceSelector,
  type TemporaryPreviewFaultScenario,
} from "../src/domain/operations/temporary-preview-fault";
import {
  validatePreviewAcceptanceDeployConfig,
  validatePreviewDeployConfig,
  type PreviewDeployConfig,
} from "./validate-preview-deploy-config";
import { createPreviewAcceptanceDeadline } from "./validate-preview-acceptance-window";

const INVALID_CONFIG =
  "Preview acceptance deployment configuration is invalid.";
const INVALID_SELECTION = "Preview acceptance workflow selection is invalid.";
const NORMAL_INPUT = "dist/vision/wrangler.json";
const ACCEPTANCE_OUTPUT = "dist/vision/wrangler.acceptance.json";
const ACCEPTANCE_CRON = "* * * * *";

/** The domain module owns the one exact selector vocabulary. */
export const PREVIEW_ACCEPTANCE_SELECTORS =
  TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS;

export type PreviewAcceptanceSelector = TemporaryPreviewAcceptanceSelector;

/** Exact operator modes exposed by the guarded workflow. */
export const PREVIEW_ACCEPTANCE_OPERATIONS = Object.freeze([
  "none",
  "observe",
  "deploy_foundation",
  "deploy_sync_suppression",
  "deploy_ai",
  "deploy_fault",
  "deploy_role_probe",
  "deploy_restore",
  "rollback",
  "close_rollback",
  "verify_cleanup",
] as const);

export type PreviewAcceptanceOperation =
  (typeof PREVIEW_ACCEPTANCE_OPERATIONS)[number];

/** Versioned canonical workflow context shared by every acceptance operation. */
export const PREVIEW_ACCEPTANCE_CONTEXT_VERSION =
  "vision.preview-acceptance-context/v1" as const;

interface PreviewAcceptanceContextBase {
  readonly version: typeof PREVIEW_ACCEPTANCE_CONTEXT_VERSION;
  readonly kind: PreviewAcceptanceOperation;
  readonly reviewedCommit: string;
}

interface PreviewAcceptanceCandidateContext
  extends PreviewAcceptanceContextBase {
  readonly kind:
    | "deploy_foundation"
    | "deploy_sync_suppression"
    | "deploy_ai"
    | "deploy_fault"
    | "deploy_role_probe"
    | "deploy_restore";
  readonly authenticatedReadsGate: "verified";
  readonly candidateRunRef: string;
  readonly rollbackClosureRunRef: string;
  readonly observerDispatchStartedAt: string;
  readonly observerDispatchCompletedAt: string;
}

export type PreviewAcceptanceContext =
  | (PreviewAcceptanceContextBase & {
      readonly kind: "none";
      readonly candidateRunRef: string;
      readonly rollbackClosureRunRef: string;
    })
  | (PreviewAcceptanceContextBase & {
      readonly kind: "observe";
      readonly evidenceFamily:
        | "foundation_probe"
        | "preview_fault"
        | "ai_usage"
        | "sync_suppression"
        | "role_probe"
        | "restore"
        | "calendar_maintenance";
      readonly expectedOutcome:
        | "foundation_succeeded"
        | "fault_expected"
        | "ai_succeeded"
        | "sync_suppressed"
        | "role_probe_succeeded"
        | "restore_succeeded"
        | "maintenance_succeeded"
        | "maintenance_repair_reserved";
      readonly faultScenario?: TemporaryPreviewFaultScenario;
      readonly maintenanceScheduledAt?: string;
    })
  | (PreviewAcceptanceCandidateContext & {
      readonly kind:
        | "deploy_foundation"
        | "deploy_sync_suppression"
        | "deploy_ai"
        | "deploy_role_probe";
    })
  | (PreviewAcceptanceCandidateContext & {
      readonly kind: "deploy_fault";
      readonly faultScenario: TemporaryPreviewFaultScenario;
    })
  | (PreviewAcceptanceCandidateContext & {
      readonly kind: "deploy_restore";
      readonly restoreAdmissionGate: "verified";
    })
  | (PreviewAcceptanceContextBase & {
      readonly kind: "rollback";
      readonly candidateRunRef: string;
    })
  | (PreviewAcceptanceContextBase & {
      readonly kind: "close_rollback";
      readonly candidateRunRef: string;
      readonly rollbackRunRef: string;
      readonly authenticatedReadsGate: "verified";
    })
  | (PreviewAcceptanceContextBase & {
      readonly kind: "verify_cleanup";
      readonly candidateRunRef: string;
      readonly rollbackClosureRunRef: string;
    });

/** Closed result used by workflow admission and candidate generation. */
export interface PreviewAcceptanceWorkflowSelection {
  readonly operation: PreviewAcceptanceOperation;
  readonly context: PreviewAcceptanceContext;
  readonly selector?: PreviewAcceptanceSelector;
}

const CANONICAL_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const REVIEWED_COMMIT = /^[0-9a-f]{40}$/u;

/** Accepts only a positive decimal workflow-run reference. */
function isRunRef(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/u.test(value);
}

/** Emits one ASCII-only canonical representation with authoritative key order. */
export function serializePreviewAcceptanceContext(
  context: PreviewAcceptanceContext,
): string {
  const canonical = canonicalPreviewAcceptanceContext(context);
  const serialized = JSON.stringify(canonical);
  if (!isBoundedAscii(serialized)) throw new Error(INVALID_SELECTION);
  return serialized;
}

/** Parses one byte-exact context and derives only its admitted selector. */
export function parsePreviewAcceptanceContext(
  operation: PreviewAcceptanceOperation,
  serialized: string,
): PreviewAcceptanceWorkflowSelection {
  try {
    if (
      !PREVIEW_ACCEPTANCE_OPERATIONS.includes(operation) ||
      !isBoundedAscii(serialized)
    ) {
      throw new Error(INVALID_SELECTION);
    }
    const parsed = JSON.parse(serialized) as unknown;
    const context = canonicalPreviewAcceptanceContext(parsed);
    if (
      context.kind !== operation ||
      JSON.stringify(context) !== serialized
    ) {
      throw new Error(INVALID_SELECTION);
    }
    const selector =
      context.kind === "deploy_foundation"
        ? "foundation_probe"
        : context.kind === "deploy_sync_suppression"
          ? "sync_suppression"
          : context.kind === "deploy_ai"
            ? "ai_usage"
            : context.kind === "deploy_fault"
              ? context.faultScenario
              : context.kind === "deploy_role_probe"
                ? "role_probe"
                : context.kind === "deploy_restore"
                  ? "restore"
              : undefined;
    return Object.freeze({
      operation,
      context,
      ...(selector === undefined ? {} : { selector }),
    });
  } catch {
    throw new Error(INVALID_SELECTION);
  }
}

/** Rebuilds one validated context without retaining caller-owned object state. */
function canonicalPreviewAcceptanceContext(
  candidate: unknown,
): PreviewAcceptanceContext {
  const record = exactPlainRecord(candidate);
  const version = dataValue(record, "version");
  const kind = dataValue(record, "kind");
  const reviewedCommit = dataValue(record, "reviewedCommit");
  if (
    version !== PREVIEW_ACCEPTANCE_CONTEXT_VERSION ||
    typeof kind !== "string" ||
    !PREVIEW_ACCEPTANCE_OPERATIONS.includes(
      kind as PreviewAcceptanceOperation,
    ) ||
    typeof reviewedCommit !== "string" ||
    !REVIEWED_COMMIT.test(reviewedCommit)
  ) {
    throw new Error(INVALID_SELECTION);
  }
  const admittedKind = kind as PreviewAcceptanceOperation;
  const base = { version } as const;
  switch (admittedKind) {
    case "none": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "candidateRunRef",
        "rollbackClosureRunRef",
      ]);
      const candidateRunRef = dataValue(record, "candidateRunRef");
      const rollbackClosureRunRef = dataValue(
        record,
        "rollbackClosureRunRef",
      );
      const baselinePair =
        candidateRunRef === "baseline" &&
        rollbackClosureRunRef === "baseline";
      const closedPair =
        isRunRef(candidateRunRef) && isRunRef(rollbackClosureRunRef);
      if (!baselinePair && !closedPair) throw new Error(INVALID_SELECTION);
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        candidateRunRef,
        rollbackClosureRunRef,
      });
    }
    case "observe": {
      const evidenceFamily = dataValue(record, "evidenceFamily");
      const expectedOutcome = dataValue(record, "expectedOutcome");
      const faultExpected =
        evidenceFamily === "preview_fault" &&
        expectedOutcome === "fault_expected";
      const maintenanceExpected =
        evidenceFamily === "calendar_maintenance" &&
        (expectedOutcome === "maintenance_succeeded" ||
          expectedOutcome === "maintenance_repair_reserved");
      exactKeys(
        record,
        faultExpected
          ? [
              "version",
              "kind",
              "reviewedCommit",
              "evidenceFamily",
              "expectedOutcome",
              "faultScenario",
            ]
          : maintenanceExpected
            ? [
                "version",
                "kind",
                "reviewedCommit",
                "evidenceFamily",
                "expectedOutcome",
                "maintenanceScheduledAt",
              ]
          : [
              "version",
              "kind",
              "reviewedCommit",
              "evidenceFamily",
              "expectedOutcome",
            ],
      );
      const matchingOutcome =
        (evidenceFamily === "foundation_probe" &&
          expectedOutcome === "foundation_succeeded") ||
        (evidenceFamily === "preview_fault" &&
          expectedOutcome === "fault_expected") ||
        (evidenceFamily === "ai_usage" &&
          expectedOutcome === "ai_succeeded") ||
        (evidenceFamily === "sync_suppression" &&
          expectedOutcome === "sync_suppressed") ||
        (evidenceFamily === "role_probe" &&
          expectedOutcome === "role_probe_succeeded") ||
        (evidenceFamily === "restore" &&
          expectedOutcome === "restore_succeeded") ||
        maintenanceExpected;
      const faultScenario = dataValue(record, "faultScenario");
      const maintenanceScheduledAt = dataValue(record, "maintenanceScheduledAt");
      if (
        !matchingOutcome ||
        (faultExpected &&
          !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
            faultScenario as TemporaryPreviewFaultScenario,
          )) ||
        (maintenanceExpected &&
          !isCanonicalInstant(maintenanceScheduledAt))
      ) {
        throw new Error(INVALID_SELECTION);
      }
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        evidenceFamily,
        expectedOutcome,
        ...(faultExpected
          ? { faultScenario: faultScenario as TemporaryPreviewFaultScenario }
          : {}),
        ...(maintenanceExpected
          ? { maintenanceScheduledAt: maintenanceScheduledAt as string }
          : {}),
      }) as PreviewAcceptanceContext;
    }
    case "deploy_foundation":
    case "deploy_sync_suppression":
    case "deploy_ai":
    case "deploy_fault":
    case "deploy_role_probe":
    case "deploy_restore": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "authenticatedReadsGate",
        "candidateRunRef",
        "rollbackClosureRunRef",
        "observerDispatchStartedAt",
        "observerDispatchCompletedAt",
        ...(kind === "deploy_fault" ? ["faultScenario"] : []),
        ...(kind === "deploy_restore" ? ["restoreAdmissionGate"] : []),
      ]);
      const authenticatedReadsGate = dataValue(
        record,
        "authenticatedReadsGate",
      );
      const candidateRunRef = dataValue(record, "candidateRunRef");
      const rollbackClosureRunRef = dataValue(
        record,
        "rollbackClosureRunRef",
      );
      const observerDispatchStartedAt = dataValue(
        record,
        "observerDispatchStartedAt",
      );
      const observerDispatchCompletedAt = dataValue(
        record,
        "observerDispatchCompletedAt",
      );
      const baselinePair =
        candidateRunRef === "baseline" &&
        rollbackClosureRunRef === "baseline";
      const closedPair =
        isRunRef(candidateRunRef) && isRunRef(rollbackClosureRunRef);
      const faultScenario = dataValue(record, "faultScenario");
      const restoreAdmissionGate = dataValue(record, "restoreAdmissionGate");
      const orderedDispatchInterval =
        isCanonicalInstant(observerDispatchStartedAt) &&
        isCanonicalInstant(observerDispatchCompletedAt) &&
        Date.parse(observerDispatchStartedAt) <=
          Date.parse(observerDispatchCompletedAt);
      if (
        authenticatedReadsGate !== "verified" ||
        (!baselinePair && !closedPair) ||
        !orderedDispatchInterval ||
        (kind === "deploy_fault" &&
          !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
            faultScenario as TemporaryPreviewFaultScenario,
          )) ||
        (kind === "deploy_restore" && restoreAdmissionGate !== "verified")
      ) {
        throw new Error(INVALID_SELECTION);
      }
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        authenticatedReadsGate,
        candidateRunRef,
        rollbackClosureRunRef,
        observerDispatchStartedAt,
        observerDispatchCompletedAt,
        ...(kind === "deploy_fault"
          ? { faultScenario: faultScenario as TemporaryPreviewFaultScenario }
          : {}),
        ...(kind === "deploy_restore"
          ? { restoreAdmissionGate: "verified" as const }
          : {}),
      }) as PreviewAcceptanceContext;
    }
    case "rollback": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "candidateRunRef",
      ]);
      const candidateRunRef = dataValue(record, "candidateRunRef");
      if (!isRunRef(candidateRunRef)) throw new Error(INVALID_SELECTION);
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        candidateRunRef,
      });
    }
    case "close_rollback": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "candidateRunRef",
        "rollbackRunRef",
        "authenticatedReadsGate",
      ]);
      const candidateRunRef = dataValue(record, "candidateRunRef");
      const rollbackRunRef = dataValue(record, "rollbackRunRef");
      const authenticatedReadsGate = dataValue(
        record,
        "authenticatedReadsGate",
      );
      if (
        !isRunRef(candidateRunRef) ||
        !isRunRef(rollbackRunRef) ||
        authenticatedReadsGate !== "verified"
      ) {
        throw new Error(INVALID_SELECTION);
      }
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        candidateRunRef,
        rollbackRunRef,
        authenticatedReadsGate,
      });
    }
    case "verify_cleanup": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "candidateRunRef",
        "rollbackClosureRunRef",
      ]);
      const candidateRunRef = dataValue(record, "candidateRunRef");
      const rollbackClosureRunRef = dataValue(
        record,
        "rollbackClosureRunRef",
      );
      if (
        !isRunRef(candidateRunRef) ||
        !isRunRef(rollbackClosureRunRef)
      ) {
        throw new Error(INVALID_SELECTION);
      }
      return Object.freeze({
        ...base,
        kind: admittedKind,
        reviewedCommit,
        candidateRunRef,
        rollbackClosureRunRef,
      });
    }
  }
  throw new Error(INVALID_SELECTION);
}

/** Restricts context transport to at most 2,048 printable ASCII bytes. */
function isBoundedAscii(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2_048 &&
    /^[\x20-\x7e]*$/u.test(value)
  );
}

/** Returns one ordinary record with enumerable data properties only. */
function exactPlainRecord(value: unknown): Readonly<Record<string, unknown>> {
  const ownKeys =
    value !== null && typeof value === "object"
      ? Reflect.ownKeys(value)
      : [];
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    ownKeys.some((key) => typeof key !== "string")
  ) {
    throw new Error(INVALID_SELECTION);
  }
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (
      descriptor?.enumerable !== true ||
      !("value" in descriptor)
    ) {
      throw new Error(INVALID_SELECTION);
    }
  }
  return record;
}

/** Reads one own enumerable data property without invoking accessors. */
function dataValue(
  record: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

/** Requires exact key membership without trusting caller insertion order. */
function exactKeys(
  record: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): void {
  const keys = Object.keys(record);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(record, key))
  ) {
    throw new Error(INVALID_SELECTION);
  }
}

/** Accepts only byte-stable canonical UTC instants. */
function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_INSTANT.test(value)) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}

/** Returns a new exact candidate and leaves the pre-validated normal input untouched. */
export function preparePreviewAcceptanceDeployConfig(input: {
  readonly normalConfig: unknown;
  readonly selector: PreviewAcceptanceSelector;
  readonly aiGatewayLimitAttested?: true;
  readonly activatedAt?: Date;
}): PreviewDeployConfig {
  try {
    validatePreviewDeployConfig(input.normalConfig);
  } catch {
    throw new Error(INVALID_CONFIG);
  }
  if (
    !PREVIEW_ACCEPTANCE_SELECTORS.includes(input.selector) ||
    (input.selector === "ai_usage") !==
      (input.aiGatewayLimitAttested === true)
  ) {
    throw new Error(INVALID_CONFIG);
  }

  const normal = structuredClone(input.normalConfig) as PreviewDeployConfig;
  const normalCrons = [
    ...((normal.triggers as { readonly crons: readonly string[] }).crons),
  ];
  const candidateCrons =
    input.selector === "sync_suppression"
      ? normalCrons
      : [...normalCrons, ACCEPTANCE_CRON];
  const candidate: PreviewDeployConfig = {
    ...normal,
    vars: {
      ...(normal.vars as Readonly<Record<string, string>>),
      PREVIEW_ACCEPTANCE_SCENARIO: input.selector,
      PREVIEW_ACCEPTANCE_EXPIRES_AT: createPreviewAcceptanceDeadline(
        input.activatedAt ?? new Date(),
        input.selector,
      ),
      ...(input.selector === "ai_usage"
        ? {
            PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
          }
        : {}),
    },
    triggers: {
      crons: candidateCrons,
    },
  };
  validatePreviewAcceptanceDeployConfig(candidate, input.selector);
  return Object.freeze(candidate);
}

/** Reads exact flag pairs without accepting repeats, aliases, or positional values. */
function readArguments(arguments_: readonly string[]): ReadonlyMap<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (
      !name?.startsWith("--") ||
      name === "--verify-workflow-inputs" ||
      value === undefined ||
      value.startsWith("--") ||
      parsed.has(name)
    ) {
      throw new Error(INVALID_SELECTION);
    }
    parsed.set(name, value);
  }
  return parsed;
}

/** Reads canonical context only from the workflow step environment. */
function readWorkflowSelectionFromEnvironment(): PreviewAcceptanceWorkflowSelection {
  const operation = process.env.ACCEPTANCE_OPERATION;
  const serialized = process.env.ACCEPTANCE_CONTEXT;
  const dispatchSha = process.env.DISPATCH_SHA;
  const checkedOutSha = process.env.CHECKED_OUT_SHA;
  if (
    typeof operation !== "string" ||
    typeof serialized !== "string" ||
    typeof dispatchSha !== "string" ||
    typeof checkedOutSha !== "string"
  ) {
    throw new Error(INVALID_SELECTION);
  }
  const selection = parsePreviewAcceptanceContext(
    operation as PreviewAcceptanceOperation,
    serialized,
  );
  if (
    dispatchSha !== selection.context.reviewedCommit ||
    checkedOutSha !== selection.context.reviewedCommit
  ) {
    throw new Error(INVALID_SELECTION);
  }
  return selection;
}

/** Executes the workflow verifier or writes the single ephemeral candidate path. */
async function main(): Promise<void> {
  try {
    const arguments_ = process.argv.slice(2);
    const verifyOnly =
      arguments_.length === 1 &&
      arguments_[0] === "--verify-workflow-inputs";
    const selection = readWorkflowSelectionFromEnvironment();
    if (verifyOnly) {
      const outputPath = process.env.GITHUB_OUTPUT;
      if (typeof outputPath !== "string" || outputPath.length === 0) {
        throw new Error(INVALID_SELECTION);
      }
      const context = selection.context;
      const candidateContext =
        context.kind === "deploy_foundation" ||
        context.kind === "deploy_sync_suppression" ||
        context.kind === "deploy_ai" ||
        context.kind === "deploy_fault" ||
        context.kind === "deploy_role_probe" ||
        context.kind === "deploy_restore"
          ? context
          : undefined;
      const candidateRunRef =
        "candidateRunRef" in context ? context.candidateRunRef : "";
      const rollbackRunRef =
        context.kind === "close_rollback" ? context.rollbackRunRef : "";
      const rollbackClosureRunRef =
        "rollbackClosureRunRef" in context
          ? context.rollbackClosureRunRef
          : "";
      const authenticatedReadsGate =
        "authenticatedReadsGate" in context
          ? context.authenticatedReadsGate
          : "";
      const faultScenario =
        "faultScenario" in context ? context.faultScenario ?? "" : "";
      const evidenceFamily =
        context.kind === "observe"
          ? context.evidenceFamily
          : selection.selector === "foundation_probe" ||
              selection.selector === "sync_suppression" ||
              selection.selector === "ai_usage" ||
              selection.selector === "role_probe" ||
              selection.selector === "restore"
            ? selection.selector
            : TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
                  selection.selector as TemporaryPreviewFaultScenario,
                )
              ? "preview_fault"
              : "";
      const expectedOutcome =
        context.kind === "observe" ? context.expectedOutcome : "";
      const maintenanceScheduledAt =
        context.kind === "observe"
          ? context.maintenanceScheduledAt ?? ""
          : "";
      await appendFile(
        outputPath,
        [
          `reviewed_commit=${context.reviewedCommit}`,
          `candidate_run_ref=${candidateRunRef}`,
          `rollback_run_ref=${rollbackRunRef}`,
          `rollback_closure_run_ref=${rollbackClosureRunRef}`,
          `authenticated_reads_gate=${authenticatedReadsGate}`,
          `fault_scenario=${faultScenario}`,
          `evidence_family=${evidenceFamily}`,
          `expected_outcome=${expectedOutcome}`,
          `maintenance_scheduled_at=${maintenanceScheduledAt}`,
          `selector=${selection.selector ?? ""}`,
          `restore_admission_gate=${selection.context.kind === "deploy_restore" ? selection.context.restoreAdmissionGate : ""}`,
          `observer_dispatch_started_at=${candidateContext?.observerDispatchStartedAt ?? ""}`,
          `observer_dispatch_completed_at=${candidateContext?.observerDispatchCompletedAt ?? ""}`,
          "",
        ].join("\n"),
        "utf8",
      );
      process.stdout.write("Preview acceptance workflow selection is valid.\n");
      return;
    }
    const parsed = readArguments(arguments_);
    if (
      parsed.get("--input") !== NORMAL_INPUT ||
      parsed.get("--output") !== ACCEPTANCE_OUTPUT ||
      parsed.size !== 3 ||
      selection.selector === undefined
    ) {
      throw new Error(INVALID_CONFIG);
    }
    const attestation = parsed.get("--ai-gateway-limit-attested");
    if (
      (selection.selector === "ai_usage" && attestation !== "true") ||
      (selection.selector !== "ai_usage" && attestation !== "")
    ) {
      throw new Error(INVALID_CONFIG);
    }
    const serialized = await readFile(resolve(NORMAL_INPUT), "utf8");
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: JSON.parse(serialized),
      selector: selection.selector,
      ...(selection.selector === "ai_usage"
        ? { aiGatewayLimitAttested: true }
        : {}),
    });
    await writeFile(
      resolve(ACCEPTANCE_OUTPUT),
      `${JSON.stringify(candidate, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    process.stdout.write("Preview acceptance candidate is ready.\n");
  } catch {
    process.stderr.write(`${INVALID_CONFIG}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
