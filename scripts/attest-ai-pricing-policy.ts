/** Attests exact server-only AI policy values without rendering them. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  AI_PRICING_POLICY_VALUES,
  assertAiPricingPolicyValues,
  type AiPricingBindingName,
} from "../src/server/ai-pricing-binding-contract";

const INVALID = "AI pricing policy attestation is invalid.";
const SOURCE_CONFIG_PATH = "wrangler.jsonc";
type DeployEnvironment = "preview" | "production";
type SourceEnvironment = "local" | DeployEnvironment;

/** Attests one flattened deploy artifact and returns no policy material. */
export function assertAiPricingDeployArtifact(
  input: unknown,
  environment: unknown,
): void {
  if (environment !== "preview" && environment !== "production") {
    throw new Error(INVALID);
  }
  const config = plainObject(input);
  const vars = plainObject(dataValue(config, "vars"));
  if (
    dataValue(config, "targetEnvironment") !== environment ||
    dataValue(vars, "VISION_ENV") !== environment
  ) {
    throw new Error(INVALID);
  }
  assertAiPricingPolicyValues(extractPolicy(vars));
}

/** Reads one source-config environment and requires the exact shared policy. */
export function readProvisionedAiPricingPolicy(
  input: unknown,
  environment: SourceEnvironment,
): Readonly<Record<AiPricingBindingName, string>> {
  const config = plainObject(input);
  const vars =
    environment === "local"
      ? plainObject(dataValue(config, "vars"))
      : plainObject(
          dataValue(
            plainObject(
              dataValue(
                plainObject(dataValue(config, "env")),
                environment,
              ),
            ),
            "vars",
          ),
        );
  const policy = extractPolicy(vars);
  assertAiPricingPolicyValues(policy);
  return Object.freeze(policy);
}

/** Extracts exactly the five pricing-policy bindings from an untrusted record. */
function extractPolicy(
  vars: Record<string, unknown> | undefined,
): Record<AiPricingBindingName, string> {
  if (vars === undefined) throw new Error(INVALID);
  return Object.fromEntries(
    (Object.keys(AI_PRICING_POLICY_VALUES) as AiPricingBindingName[]).map(
      (name) => [name, dataValue(vars, name)],
    ),
  ) as Record<AiPricingBindingName, string>;
}

/** Reads one own enumerable data property without invoking accessors. */
function dataValue(
  record: Record<string, unknown> | undefined,
  key: string,
): unknown {
  const descriptor =
    record === undefined ? undefined : Object.getOwnPropertyDescriptor(record, key);
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
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Parses the two fixed artifact/config path pairs without aliases or repeats. */
function readArguments(arguments_: readonly string[]): ReadonlyMap<string, string> {
  if (arguments_.length !== 4) throw new Error(INVALID);
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

/** Attests both environments and emits only a fixed value-free success message. */
async function main(): Promise<void> {
  try {
    const parsed = readArguments(process.argv.slice(2));
    const environment = parsed.get("--environment");
    const configPath = parsed.get("--config");
    if (
      (environment !== "preview" && environment !== "production") ||
      configPath === undefined
    ) {
      throw new Error(INVALID);
    }
    const input = JSON.parse(
      await readFile(resolve(configPath), "utf8"),
    ) as unknown;
    const sourceConfig = JSON.parse(
      await readFile(resolve(SOURCE_CONFIG_PATH), "utf8"),
    ) as unknown;
    readProvisionedAiPricingPolicy(sourceConfig, environment);
    assertAiPricingDeployArtifact(input, environment);
    process.stdout.write("AI pricing policy attestation is valid.\n");
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
