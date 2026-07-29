/** Builds one reviewed preview-only acceptance artifact from the normal build output. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TEMPORARY_PREVIEW_FAULT_SCENARIOS } from "../src/domain/operations/temporary-preview-fault";
import {
  validatePreviewAcceptanceDeployConfig,
  validatePreviewDeployConfig,
  type PreviewDeployConfig,
} from "./validate-preview-deploy-config";

const INVALID_CONFIG =
  "Preview acceptance deployment configuration is invalid.";
const INVALID_SELECTION = "Preview acceptance workflow selection is invalid.";
const NORMAL_INPUT = "dist/vision/wrangler.json";
const ACCEPTANCE_OUTPUT = "dist/vision/wrangler.acceptance.json";
const ACCEPTANCE_CRON = "* * * * *";

/** Dedicated evidence selectors remain outside the frozen six-fault tuple. */
export const PREVIEW_ACCEPTANCE_EVIDENCE_SELECTORS = Object.freeze([
  "foundation_probe",
  "ai_usage",
] as const);

/** The exact selector vocabulary accepted by the generated artifact builder. */
export const PREVIEW_ACCEPTANCE_SELECTORS = Object.freeze([
  ...TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  ...PREVIEW_ACCEPTANCE_EVIDENCE_SELECTORS,
] as const);

export type PreviewAcceptanceSelector =
  (typeof PREVIEW_ACCEPTANCE_SELECTORS)[number];

/** Exact operator modes exposed by the guarded workflow. */
export const PREVIEW_ACCEPTANCE_OPERATIONS = Object.freeze([
  "none",
  "observe",
  "deploy_foundation",
  "deploy_ai",
  "deploy_fault",
  "rollback",
] as const);

export type PreviewAcceptanceOperation =
  (typeof PREVIEW_ACCEPTANCE_OPERATIONS)[number];

/** Operator attestation state for authenticated post-deploy read checks. */
export type PreviewAuthenticatedReadsGate = "not_verified" | "verified";

/** Closed result used by both workflow verification and candidate generation. */
export interface PreviewAcceptanceWorkflowSelection {
  readonly operation: PreviewAcceptanceOperation;
  readonly authenticatedReadsGate: PreviewAuthenticatedReadsGate;
  readonly faultScenario:
    | "none"
    | (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number];
  readonly selector?: PreviewAcceptanceSelector;
}

/** Validates the one allowed operation/fault combination without coercion. */
export function validatePreviewAcceptanceWorkflowInputs(
  operation: unknown,
  faultScenario: unknown,
  authenticatedReadsGate: unknown,
): PreviewAcceptanceWorkflowSelection {
  if (
    typeof operation !== "string" ||
    typeof faultScenario !== "string" ||
    (authenticatedReadsGate !== "not_verified" &&
      authenticatedReadsGate !== "verified") ||
    !PREVIEW_ACCEPTANCE_OPERATIONS.includes(
      operation as PreviewAcceptanceOperation,
    )
  ) {
    throw new Error(INVALID_SELECTION);
  }
  const admittedOperation = operation as PreviewAcceptanceOperation;
  const requiresAuthenticatedReads =
    admittedOperation !== "none" && admittedOperation !== "observe";
  if (
    requiresAuthenticatedReads !==
    (authenticatedReadsGate === "verified")
  ) {
    throw new Error(INVALID_SELECTION);
  }
  if (admittedOperation === "deploy_fault") {
    if (
      !TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
        faultScenario as (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number],
      )
    ) {
      throw new Error(INVALID_SELECTION);
    }
    return Object.freeze({
      operation: admittedOperation,
      authenticatedReadsGate,
      faultScenario:
        faultScenario as (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number],
      selector:
        faultScenario as (typeof TEMPORARY_PREVIEW_FAULT_SCENARIOS)[number],
    });
  }
  if (faultScenario !== "none") {
    throw new Error(INVALID_SELECTION);
  }
  if (admittedOperation === "deploy_foundation") {
    return Object.freeze({
      operation: admittedOperation,
      authenticatedReadsGate,
      faultScenario: "none",
      selector: "foundation_probe",
    });
  }
  if (admittedOperation === "deploy_ai") {
    return Object.freeze({
      operation: admittedOperation,
      authenticatedReadsGate,
      faultScenario: "none",
      selector: "ai_usage",
    });
  }
  return Object.freeze({
    operation: admittedOperation,
    authenticatedReadsGate,
    faultScenario: "none",
  });
}

/** Returns a new exact candidate and leaves the pre-validated normal input untouched. */
export function preparePreviewAcceptanceDeployConfig(input: {
  readonly normalConfig: unknown;
  readonly selector: PreviewAcceptanceSelector;
  readonly aiGatewayLimitAttested?: true;
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
  const candidate: PreviewDeployConfig = {
    ...normal,
    vars: {
      ...(normal.vars as Readonly<Record<string, string>>),
      PREVIEW_ACCEPTANCE_SCENARIO: input.selector,
      ...(input.selector === "ai_usage"
        ? {
            PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
          }
        : {}),
    },
    triggers: {
      crons: [
        ...((normal.triggers as { readonly crons: readonly string[] }).crons),
        ACCEPTANCE_CRON,
      ],
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

/** Executes the workflow verifier or writes the single ephemeral candidate path. */
async function main(): Promise<void> {
  try {
    const arguments_ = process.argv.slice(2);
    const verifyOnly = arguments_[0] === "--verify-workflow-inputs";
    const parsed = readArguments(verifyOnly ? arguments_.slice(1) : arguments_);
    const selection = validatePreviewAcceptanceWorkflowInputs(
      parsed.get("--operation"),
      parsed.get("--fault-scenario"),
      parsed.get("--authenticated-reads-gate"),
    );
    if (verifyOnly) {
      if (parsed.size !== 3) throw new Error(INVALID_SELECTION);
      process.stdout.write("Preview acceptance workflow selection is valid.\n");
      return;
    }
    if (
      parsed.get("--input") !== NORMAL_INPUT ||
      parsed.get("--output") !== ACCEPTANCE_OUTPUT ||
      parsed.size !== 6 ||
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
