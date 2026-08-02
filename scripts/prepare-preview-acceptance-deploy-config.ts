/** Builds one reviewed preview-only acceptance artifact from the normal build output. */
import { createHash } from "node:crypto";
import { appendFile, open, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertPreviewAiRequestMargin,
  createPreviewAiEvidenceWindow,
  parseTemporaryPreviewAiEvidenceWindow,
  TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS,
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  type PreviewAiEvidenceWindow,
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
const DISPATCH_CORRELATION_EVIDENCE_OUTPUT =
  "preview-dispatch-correlation.json";
const MAX_DISPATCH_CORRELATION_EVIDENCE_BYTES = 2_048;
const MAX_DISPATCH_CORRELATION_CONTEXT_BYTES = 2_048;
const DISPATCH_CORRELATION_VERIFIED =
  "Preview dispatch correlation evidence is valid.\n";
const DISPATCH_CORRELATION_REJECTED =
  "Preview dispatch correlation evidence is invalid.\n";

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
  "vision.preview-acceptance-context/v2" as const;

/** The sole closed operator attestation accepted for AI candidate admission. */
export type PreviewAiZeroActiveGate = "verified";

interface PreviewAcceptanceContextBase {
  readonly version: typeof PREVIEW_ACCEPTANCE_CONTEXT_VERSION;
  readonly kind: PreviewAcceptanceOperation;
  readonly reviewedCommit: string;
  readonly dispatchCorrelation: string;
}

/** Exact review evidence bound to one canonical dispatch context. */
export interface PreviewDispatchCorrelationEvidence {
  readonly evidenceType: "vision.preview-dispatch-correlation/v1";
  readonly operation: PreviewAcceptanceOperation;
  readonly reviewedCommit: string;
  readonly contextHash: string;
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

interface PreviewAcceptanceObserveContextBase
  extends PreviewAcceptanceContextBase {
  readonly kind: "observe";
}

type PreviewAcceptanceNonAiObserveContext =
  PreviewAcceptanceObserveContextBase & {
    readonly evidenceScheduledAt?: never;
    readonly expiresAt?: never;
  } & (
      | {
          readonly evidenceFamily: "foundation_probe";
          readonly expectedOutcome: "foundation_succeeded";
          readonly faultScenario?: never;
          readonly maintenanceScheduledAt?: never;
        }
      | {
          readonly evidenceFamily: "preview_fault";
          readonly expectedOutcome: "fault_expected";
          readonly faultScenario: TemporaryPreviewFaultScenario;
          readonly maintenanceScheduledAt?: never;
        }
      | {
          readonly evidenceFamily: "sync_suppression";
          readonly expectedOutcome: "sync_suppressed";
          readonly faultScenario?: never;
          readonly maintenanceScheduledAt?: never;
        }
      | {
          readonly evidenceFamily: "role_probe";
          readonly expectedOutcome: "role_probe_succeeded";
          readonly faultScenario?: never;
          readonly maintenanceScheduledAt?: never;
        }
      | {
          readonly evidenceFamily: "restore";
          readonly expectedOutcome: "restore_succeeded";
          readonly faultScenario?: never;
          readonly maintenanceScheduledAt?: never;
        }
      | {
          readonly evidenceFamily: "calendar_maintenance";
          readonly expectedOutcome:
            | "maintenance_succeeded"
            | "maintenance_repair_reserved";
          readonly faultScenario?: never;
          readonly maintenanceScheduledAt: string;
        }
    );

type PreviewAcceptanceAiObserveContext =
  PreviewAcceptanceObserveContextBase & {
    readonly evidenceFamily: "ai_usage";
    readonly expectedOutcome: "ai_succeeded";
    readonly faultScenario?: never;
    readonly maintenanceScheduledAt?: never;
    readonly evidenceScheduledAt: string;
    readonly expiresAt: string;
  };

export type PreviewAcceptanceContext =
  | (PreviewAcceptanceContextBase & {
      readonly kind: "none";
      readonly candidateRunRef: string;
      readonly rollbackClosureRunRef: string;
    })
  | PreviewAcceptanceNonAiObserveContext
  | PreviewAcceptanceAiObserveContext
  | (PreviewAcceptanceCandidateContext & {
      readonly kind:
        | "deploy_foundation"
        | "deploy_sync_suppression"
        | "deploy_role_probe";
    })
  | (PreviewAcceptanceCandidateContext & {
      readonly kind: "deploy_ai";
      readonly aiZeroActiveGate: PreviewAiZeroActiveGate;
      readonly evidenceScheduledAt: string;
      readonly expiresAt: string;
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
const DISPATCH_CORRELATION = /^[a-f0-9]{64}$/u;

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

/** Creates exact evidence from one byte-canonical dispatch context. */
export function createPreviewDispatchCorrelationEvidence(
  operation: PreviewAcceptanceOperation,
  serializedContext: string,
): PreviewDispatchCorrelationEvidence {
  const selection = parsePreviewAcceptanceContext(operation, serializedContext);
  return Object.freeze({
    evidenceType: "vision.preview-dispatch-correlation/v1",
    operation: selection.operation,
    reviewedCommit: selection.context.reviewedCommit,
    contextHash: createHash("sha256")
      .update(serializedContext, "utf8")
      .digest("hex"),
  });
}

/** Requires exact evidence bound to one operation, commit, and context byte string. */
export function assertPreviewDispatchCorrelationEvidence(input: {
  readonly evidence: unknown;
  readonly operation: PreviewAcceptanceOperation;
  readonly serializedContext: string;
  readonly expectedCommit: string;
}): void {
  try {
    const selection = parsePreviewAcceptanceContext(
      input.operation,
      input.serializedContext,
    );
    const evidence = exactPlainRecord(input.evidence);
    exactKeys(evidence, [
      "evidenceType",
      "operation",
      "reviewedCommit",
      "contextHash",
    ]);
    const contextHash = createHash("sha256")
      .update(input.serializedContext, "utf8")
      .digest("hex");
    if (
      dataValue(evidence, "evidenceType") !==
        "vision.preview-dispatch-correlation/v1" ||
      dataValue(evidence, "operation") !== input.operation ||
      dataValue(evidence, "reviewedCommit") !== input.expectedCommit ||
      selection.context.reviewedCommit !== input.expectedCommit ||
      dataValue(evidence, "contextHash") !== contextHash
    ) {
      throw new Error(INVALID_SELECTION);
    }
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
  const dispatchCorrelation = dataValue(record, "dispatchCorrelation");
  if (
    version !== PREVIEW_ACCEPTANCE_CONTEXT_VERSION ||
    typeof kind !== "string" ||
    !PREVIEW_ACCEPTANCE_OPERATIONS.includes(
      kind as PreviewAcceptanceOperation,
    ) ||
    typeof reviewedCommit !== "string" ||
    !REVIEWED_COMMIT.test(reviewedCommit) ||
    typeof dispatchCorrelation !== "string" ||
    !DISPATCH_CORRELATION.test(dispatchCorrelation)
  ) {
    throw new Error(INVALID_SELECTION);
  }
  const admittedKind = kind as PreviewAcceptanceOperation;
  const base = {
    version,
    kind: admittedKind,
    reviewedCommit,
    dispatchCorrelation,
  } as const;
  switch (admittedKind) {
    case "none": {
      exactKeys(record, [
        "version",
        "kind",
        "reviewedCommit",
        "dispatchCorrelation",
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
      const aiExpected =
        evidenceFamily === "ai_usage" && expectedOutcome === "ai_succeeded";
      exactKeys(
        record,
        faultExpected
          ? [
              "version",
              "kind",
              "reviewedCommit",
              "dispatchCorrelation",
              "evidenceFamily",
              "expectedOutcome",
              "faultScenario",
            ]
          : maintenanceExpected
            ? [
                "version",
                "kind",
                "reviewedCommit",
                "dispatchCorrelation",
                "evidenceFamily",
                "expectedOutcome",
                "maintenanceScheduledAt",
              ]
            : aiExpected
              ? [
                  "version",
                  "kind",
                  "reviewedCommit",
                  "dispatchCorrelation",
                  "evidenceFamily",
                  "expectedOutcome",
                  "evidenceScheduledAt",
                  "expiresAt",
                ]
          : [
              "version",
              "kind",
              "reviewedCommit",
              "dispatchCorrelation",
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
      const evidenceScheduledAt = dataValue(record, "evidenceScheduledAt");
      const expiresAt = dataValue(record, "expiresAt");
      if (aiExpected) {
        parseCanonicalAiWindow(evidenceScheduledAt, expiresAt);
      }
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
        ...(aiExpected
          ? {
              evidenceScheduledAt: evidenceScheduledAt as string,
              expiresAt: expiresAt as string,
            }
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
        "dispatchCorrelation",
        "authenticatedReadsGate",
        "candidateRunRef",
        "rollbackClosureRunRef",
        "observerDispatchStartedAt",
        "observerDispatchCompletedAt",
        ...(kind === "deploy_ai"
          ? ["aiZeroActiveGate", "evidenceScheduledAt", "expiresAt"]
          : []),
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
      const aiZeroActiveGate = dataValue(record, "aiZeroActiveGate");
      const evidenceScheduledAt = dataValue(record, "evidenceScheduledAt");
      const expiresAt = dataValue(record, "expiresAt");
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
        (kind === "deploy_restore" && restoreAdmissionGate !== "verified") ||
        (kind === "deploy_ai" && aiZeroActiveGate !== "verified")
      ) {
        throw new Error(INVALID_SELECTION);
      }
      if (kind === "deploy_ai") {
        const aiWindow = parseCanonicalAiWindow(
          evidenceScheduledAt,
          expiresAt,
        );
        const observerStartedAt = new Date(observerDispatchStartedAt as string);
        const observerCompletedAt = new Date(
          observerDispatchCompletedAt as string,
        );
        if (
          aiWindow.activatedAt.getTime() > observerStartedAt.getTime()
        ) {
          throw new Error(INVALID_SELECTION);
        }
        assertPreviewAiRequestMargin(
          observerCompletedAt,
          aiWindow.evidenceScheduledAt,
        );
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
        ...(kind === "deploy_ai"
          ? {
              aiZeroActiveGate: "verified" as const,
              evidenceScheduledAt: evidenceScheduledAt as string,
              expiresAt: expiresAt as string,
            }
          : {}),
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
        "dispatchCorrelation",
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
        "dispatchCorrelation",
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
        "dispatchCorrelation",
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

/** Reuses the domain parser for one canonical context-carried AI window. */
function parseCanonicalAiWindow(
  evidenceScheduledAt: unknown,
  expiresAt: unknown,
): PreviewAiEvidenceWindow {
  const window = parseTemporaryPreviewAiEvidenceWindow({
    VISION_ENV: "preview",
    PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
    PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: evidenceScheduledAt,
    PREVIEW_ACCEPTANCE_EXPIRES_AT: expiresAt,
  });
  if (window === undefined) throw new Error(INVALID_SELECTION);
  return window;
}

/** Returns a new exact candidate and leaves the pre-validated normal input untouched. */
export function preparePreviewAcceptanceDeployConfig(input: {
  readonly normalConfig: unknown;
  readonly selector: PreviewAcceptanceSelector;
  readonly aiGatewayLimitAttested?: true;
  readonly activatedAt?: Date;
  readonly aiEvidenceWindow?: PreviewAiEvidenceWindow;
}): PreviewDeployConfig {
  try {
    validatePreviewDeployConfig(input.normalConfig);
  } catch {
    throw new Error(INVALID_CONFIG);
  }
  if (
    !PREVIEW_ACCEPTANCE_SELECTORS.includes(input.selector) ||
    (input.selector === "ai_usage") !==
      (input.aiGatewayLimitAttested === true) ||
    (input.selector !== "ai_usage" && input.aiEvidenceWindow !== undefined)
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
  const aiWindow =
    input.selector === "ai_usage"
      ? input.aiEvidenceWindow ??
        createPreviewAiEvidenceWindow(input.activatedAt ?? new Date())
      : undefined;
  const candidate: PreviewDeployConfig = {
    ...normal,
    vars: {
      ...(normal.vars as Readonly<Record<string, string>>),
      PREVIEW_ACCEPTANCE_SCENARIO: input.selector,
      PREVIEW_ACCEPTANCE_EXPIRES_AT:
        aiWindow?.expiresAt.toISOString() ??
        createPreviewAcceptanceDeadline(
          input.activatedAt ?? new Date(),
          input.selector,
        ),
      ...(input.selector === "ai_usage"
        ? {
            PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
              aiWindow!.evidenceScheduledAt.toISOString(),
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

/** Reads one UTF-8 input without admitting a file larger than the exact contract bound. */
async function readBoundedUtf8File(
  path: string,
  maximumBytes: number,
): Promise<string> {
  if (path.length === 0 || path.length > 4_096) {
    throw new Error(INVALID_SELECTION);
  }
  const handle = await open(path, "r");
  try {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (totalBytes <= maximumBytes) {
      const buffer = Buffer.alloc(maximumBytes + 1 - totalBytes);
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        totalBytes,
      );
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
    }
    if (totalBytes > maximumBytes) throw new Error(INVALID_SELECTION);
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, totalBytes),
    );
  } finally {
    await handle.close();
  }
}

/** Runs the closed file-based dispatch-correlation verifier without rendering inputs. */
async function verifyDispatchCorrelation(
  arguments_: readonly string[],
): Promise<void> {
  try {
    if (
      arguments_.length !== 9 ||
      arguments_[0] !== "--verify-dispatch-correlation" ||
      arguments_[1] !== "--evidence" ||
      arguments_[3] !== "--operation" ||
      arguments_[5] !== "--context" ||
      arguments_[7] !== "--commit"
    ) {
      throw new Error(INVALID_SELECTION);
    }
    const evidencePath = arguments_[2];
    const operation = arguments_[4];
    const contextPath = arguments_[6];
    const expectedCommit = arguments_[8];
    if (
      evidencePath === undefined ||
      contextPath === undefined ||
      expectedCommit === undefined ||
      !PREVIEW_ACCEPTANCE_OPERATIONS.includes(
        operation as PreviewAcceptanceOperation,
      ) ||
      !REVIEWED_COMMIT.test(expectedCommit)
    ) {
      throw new Error(INVALID_SELECTION);
    }
    const [serializedContext, serializedEvidence] = await Promise.all([
      readBoundedUtf8File(contextPath, MAX_DISPATCH_CORRELATION_CONTEXT_BYTES),
      readBoundedUtf8File(
        evidencePath,
        MAX_DISPATCH_CORRELATION_EVIDENCE_BYTES,
      ),
    ]);
    assertPreviewDispatchCorrelationEvidence({
      evidence: JSON.parse(serializedEvidence) as unknown,
      operation: operation as PreviewAcceptanceOperation,
      serializedContext,
      expectedCommit,
    });
    process.stdout.write(DISPATCH_CORRELATION_VERIFIED);
  } catch {
    process.stderr.write(DISPATCH_CORRELATION_REJECTED);
    process.exitCode = 1;
  }
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
  const arguments_ = process.argv.slice(2);
  if (arguments_[0] === "--verify-dispatch-correlation") {
    await verifyDispatchCorrelation(arguments_);
    return;
  }
  try {
    const verifyOnly =
      arguments_.length === 1 &&
      arguments_[0] === "--verify-workflow-inputs";
    const selection = readWorkflowSelectionFromEnvironment();
    if (verifyOnly) {
      const outputPath = process.env.GITHUB_OUTPUT;
      if (typeof outputPath !== "string" || outputPath.length === 0) {
        throw new Error(INVALID_SELECTION);
      }
      const serializedContext = process.env.ACCEPTANCE_CONTEXT;
      if (typeof serializedContext !== "string") {
        throw new Error(INVALID_SELECTION);
      }
      const evidence = createPreviewDispatchCorrelationEvidence(
        selection.operation,
        serializedContext,
      );
      await writeFile(
        resolve(DISPATCH_CORRELATION_EVIDENCE_OUTPUT),
        `${JSON.stringify(evidence)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
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
      const evidenceScheduledAt =
        (context.kind === "observe" && context.evidenceFamily === "ai_usage") ||
        context.kind === "deploy_ai"
          ? context.evidenceScheduledAt ?? ""
          : "";
      const expiresAt =
        (context.kind === "observe" && context.evidenceFamily === "ai_usage") ||
        context.kind === "deploy_ai"
          ? context.expiresAt ?? ""
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
          `evidence_scheduled_at=${evidenceScheduledAt}`,
          `expires_at=${expiresAt}`,
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
    const contextAiWindow =
      selection.context.kind === "deploy_ai"
        ? parseCanonicalAiWindow(
            selection.context.evidenceScheduledAt,
            selection.context.expiresAt,
          )
        : undefined;
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: JSON.parse(serialized),
      selector: selection.selector,
      ...(selection.selector === "ai_usage"
        ? {
            aiGatewayLimitAttested: true,
            aiEvidenceWindow: contextAiWindow!,
          }
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
