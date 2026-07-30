/** Validates immutable normal and generated acceptance preview deploy artifacts. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  AI_PRICING_BINDING_CONTRACT,
  AI_PRICING_POLICY_VALUES,
} from "../src/server/ai-pricing-binding-contract";
import { TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS } from "../src/domain/operations/temporary-preview-fault";
import type { PreviewAcceptanceSelector } from "./prepare-preview-acceptance-deploy-config";

const INVALID_NORMAL = "Preview deployment configuration is invalid.";
const INVALID_ACCEPTANCE =
  "Preview acceptance deployment configuration is invalid.";
const INVALID_PROVIDER_STATE = "Normal preview provider state is invalid.";
const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;
const ACCEPTANCE_CRON = "* * * * *";
const CANONICAL_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const NORMAL_VAR_ENTRIES = Object.freeze({
  AI_MONTHLY_HARD_LIMIT_CENTS: "950",
  ...AI_PRICING_POLICY_VALUES,
  BACKUP_KEY_VERSION: "1",
  DATABASE_USAGE_WARNING_BYTES: "400000000",
  GOOGLE_REDIRECT_URI:
    "https://vision-preview.june74.workers.dev/api/auth/google/callback",
  R2_USAGE_WARNING_BYTES: "8000000000",
  R2_USAGE_WARNING_OBJECTS: "100",
  VISION_ENV: "preview",
});
const ACCEPTANCE_SELECTORS = new Set(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS);
interface ProviderBindingContract {
  readonly name: string;
  readonly type: string;
  readonly text?: string;
}

const NORMAL_PROVIDER_BINDING_CONTRACT: readonly ProviderBindingContract[] =
  Object.freeze([
  ...AI_PRICING_BINDING_CONTRACT.map(({ name, type, value }) =>
    Object.freeze({ name, type, text: value }),
  ),
  Object.freeze({
    name: "AI_MONTHLY_HARD_LIMIT_CENTS",
    type: "plain_text",
  }),
  Object.freeze({ name: "BACKUP_BUCKET", type: "r2_bucket" }),
  Object.freeze({ name: "BACKUP_ENCRYPTION_KEY", type: "secret_text" }),
  Object.freeze({ name: "BACKUP_KEY_VERSION", type: "plain_text" }),
  Object.freeze({ name: "CALENDAR_SYNC_QUEUE", type: "queue" }),
  Object.freeze({ name: "DATABASE_URL", type: "secret_text" }),
  Object.freeze({
    name: "DATABASE_USAGE_WARNING_BYTES",
    type: "plain_text",
  }),
  Object.freeze({ name: "GOOGLE_ALLOWED_EMAIL", type: "secret_text" }),
  Object.freeze({ name: "GOOGLE_ALLOWED_SUB", type: "secret_text" }),
  Object.freeze({ name: "GOOGLE_CLIENT_ID", type: "secret_text" }),
  Object.freeze({ name: "GOOGLE_CLIENT_SECRET", type: "secret_text" }),
  Object.freeze({ name: "GOOGLE_REDIRECT_URI", type: "plain_text" }),
  Object.freeze({ name: "KEY_ENCRYPTION_KEY", type: "secret_text" }),
  Object.freeze({ name: "OPENAI_API_KEY", type: "secret_text" }),
  Object.freeze({
    name: "OPENAI_GATEWAY_BASE_URL",
    type: "secret_text",
  }),
  Object.freeze({ name: "R2_USAGE_WARNING_BYTES", type: "plain_text" }),
  Object.freeze({ name: "R2_USAGE_WARNING_OBJECTS", type: "plain_text" }),
  Object.freeze({ name: "VISION_ENV", type: "plain_text" }),
  Object.freeze({ name: "VISION_USER_TIME_ZONE", type: "secret_text" }),
  ]);
const INVALID_RESTORE_PROVIDER_STATE =
  "Temporary restore-pair provider state is invalid.";

/** Flattened Cloudflare Vite output used by normal and acceptance deployments. */
export interface PreviewDeployConfig {
  readonly targetEnvironment?: unknown;
  readonly vars?: unknown;
  readonly queues?: unknown;
  readonly triggers?: unknown;
  readonly r2_buckets?: unknown;
  readonly [key: string]: unknown;
}

/** Live responses required before a candidate and after normal rollback. */
export interface NormalPreviewProviderState {
  readonly healthResponse: unknown;
  readonly schedulesResponse: unknown;
  readonly settingsResponse: unknown;
}

/** Enforces the exact immutable normal preview environment artifact. */
export function validatePreviewDeployConfig(candidate: unknown): void {
  validate(candidate, undefined, INVALID_NORMAL);
}

/**
 * Requires healthy runtime, the two normal schedules, and an explicit binding
 * inventory with no temporary acceptance binding.
 */
export function validateNormalPreviewProviderState(
  input: NormalPreviewProviderState,
): void {
  const health = isPlainDataObject(input.healthResponse)
    ? input.healthResponse
    : {};
  const schedules = isPlainDataObject(input.schedulesResponse)
    ? input.schedulesResponse
    : {};
  const scheduleResult = ownDataValue(schedules, "result");
  const bindings = readProviderBindings(input.settingsResponse);
  const scheduleCrons =
    Array.isArray(scheduleResult) &&
    scheduleResult.every(
      (entry) =>
        isPlainDataObject(entry) &&
        typeof ownDataValue(entry, "cron") === "string",
    )
      ? scheduleResult
          .map((entry) => ownDataValue(entry, "cron") as string)
          .sort()
      : [];
  const expectedCrons = [...NORMAL_CRONS].sort();

  if (
    ownDataValue(health, "status") !== "ok" ||
    ownDataValue(schedules, "success") !== true ||
    !exactStringArray(scheduleCrons, expectedCrons) ||
    bindings === undefined ||
    !matchesNormalProviderBindingContract(bindings)
  ) {
    throw new Error(INVALID_PROVIDER_STATE);
  }
}

/** Requires normal bindings plus exactly two temporary restore secrets. */
export function validateTemporaryRestorePairProviderState(
  input: NormalPreviewProviderState,
): void {
  try {
    const bindings = readProviderBindings(input.settingsResponse);
    if (
      bindings === undefined ||
      bindings.length !== NORMAL_PROVIDER_BINDING_CONTRACT.length + 2 ||
      !matchesNormalProviderBindingContract(
        bindings.filter((binding) => {
          if (!isPlainDataObject(binding)) return true;
          const name = ownDataValue(binding, "name");
          return name !== "PREVIEW_RESTORE_DATABASE_URL" &&
            name !== "PREVIEW_RESTORE_TARGET_ID";
        }),
      )
    ) throw new Error(INVALID_RESTORE_PROVIDER_STATE);
    const temporary = bindings.filter((binding) =>
      isPlainDataObject(binding) &&
      (ownDataValue(binding, "name") === "PREVIEW_RESTORE_DATABASE_URL" ||
        ownDataValue(binding, "name") === "PREVIEW_RESTORE_TARGET_ID"));
    if (
      temporary.length !== 2 ||
      !["PREVIEW_RESTORE_DATABASE_URL", "PREVIEW_RESTORE_TARGET_ID"].every(
        (name) => temporary.some((binding) =>
          ownDataValue(binding as Record<string, unknown>, "name") === name &&
          ownDataValue(binding as Record<string, unknown>, "type") === "secret_text"),
      )
    ) throw new Error(INVALID_RESTORE_PROVIDER_STATE);
  } catch {
    throw new Error(INVALID_RESTORE_PROVIDER_STATE);
  }
}

/** Requires every normal binding exactly once with its authoritative provider type. */
function matchesNormalProviderBindingContract(
  bindings: readonly unknown[],
): boolean {
  if (bindings.length !== NORMAL_PROVIDER_BINDING_CONTRACT.length) {
    return false;
  }
  const actual = new Map<string, { readonly text: unknown; readonly type: string }>();
  for (const binding of bindings) {
    if (!isPlainDataObject(binding)) return false;
    const name = ownDataValue(binding, "name");
    const type = ownDataValue(binding, "type");
    if (
      typeof name !== "string" ||
      typeof type !== "string" ||
      actual.has(name)
    ) {
      return false;
    }
    actual.set(name, {
      text: ownDataValue(binding, "text"),
      type,
    });
  }
  return NORMAL_PROVIDER_BINDING_CONTRACT.every(
    ({ name, text, type }) => {
      const binding = actual.get(name);
      return (
        binding?.type === type &&
        (text === undefined || binding.text === text)
      );
    },
  );
}

/** Enforces one generated selector, one extra cron, and AI-only attestation. */
export function validatePreviewAcceptanceDeployConfig(
  candidate: unknown,
  expectedSelector: PreviewAcceptanceSelector,
): void {
  if (
    typeof expectedSelector !== "string" ||
    !ACCEPTANCE_SELECTORS.has(expectedSelector)
  ) {
    throw new Error(INVALID_ACCEPTANCE);
  }
  validate(candidate, expectedSelector, INVALID_ACCEPTANCE);
}

/** Validates common deploy bindings and one exact normal/candidate mode. */
function validate(
  candidate: unknown,
  expectedSelector: PreviewAcceptanceSelector | undefined,
  errorMessage: string,
): void {
  const config =
    isPlainDataObject(candidate) ? (candidate as PreviewDeployConfig) : {};
  const vars = isPlainDataObject(config.vars)
    ? (config.vars as Readonly<Record<string, unknown>>)
    : {};
  const buckets = Array.isArray(config.r2_buckets)
    ? config.r2_buckets
    : [];
  const queues = isPlainDataObject(config.queues)
    ? (config.queues as Readonly<Record<string, unknown>>)
    : {};
  const producers = Array.isArray(queues.producers)
    ? queues.producers
    : [];
  const consumers = Array.isArray(queues.consumers)
    ? queues.consumers
    : [];
  const triggers = isPlainDataObject(config.triggers)
    ? (config.triggers as Readonly<Record<string, unknown>>)
    : {};
  const crons = Array.isArray(triggers.crons) ? triggers.crons : [];
  const expectedCrons =
    expectedSelector === undefined || expectedSelector === "sync_suppression"
      ? NORMAL_CRONS
      : [...NORMAL_CRONS, ACCEPTANCE_CRON];
  const acceptanceExpiresAt =
    expectedSelector === undefined
      ? undefined
      : readOwnString(vars, "PREVIEW_ACCEPTANCE_EXPIRES_AT");
  const acceptanceExpiresAtMs =
    acceptanceExpiresAt === undefined ? Number.NaN : Date.parse(acceptanceExpiresAt);
  if (
    expectedSelector !== undefined &&
    (acceptanceExpiresAt === undefined ||
      !CANONICAL_INSTANT.test(acceptanceExpiresAt) ||
      !Number.isFinite(acceptanceExpiresAtMs) ||
      new Date(acceptanceExpiresAtMs).toISOString() !== acceptanceExpiresAt)
  ) {
    throw new Error(errorMessage);
  }
  const expectedVars: Readonly<Record<string, string>> = {
    ...NORMAL_VAR_ENTRIES,
    ...(expectedSelector === undefined
      ? {}
      : {
          PREVIEW_ACCEPTANCE_EXPIRES_AT: acceptanceExpiresAt!,
          PREVIEW_ACCEPTANCE_SCENARIO: expectedSelector,
        }),
    ...(expectedSelector === "ai_usage"
      ? { PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true" }
      : {}),
  };

  if (
    config.targetEnvironment !== "preview" ||
    !exactStringRecord(vars, expectedVars) ||
    !exactStringArray(crons, expectedCrons) ||
    !validQueue(producers, consumers) ||
    !validBucket(buckets)
  ) {
    throw new Error(errorMessage);
  }
}

/** Reads one exact own string binding without invoking accessors. */
function readOwnString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true &&
    "value" in descriptor &&
    typeof descriptor.value === "string"
    ? descriptor.value
    : undefined;
}

/** Requires exact own enumerable scalar variables and rejects hidden terminal modes. */
function exactStringRecord(
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, string>>,
): boolean {
  if (!isPlainDataObject(actual)) return false;
  const keys = Reflect.ownKeys(actual);
  const expectedKeys = Object.keys(expected).sort();
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== expectedKeys.length ||
    Object.getOwnPropertySymbols(actual).length !== 0 ||
    Object.getPrototypeOf(actual) !== Object.prototype
  ) {
    return false;
  }
  const actualKeys = Object.keys(actual).sort();
  return (
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    expectedKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, key);
      return (
        descriptor?.enumerable === true &&
        "value" in descriptor &&
        descriptor.value === expected[key]
      );
    })
  );
}

/** Requires an exact ordered array of primitive strings. */
function exactStringArray(
  actual: readonly unknown[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

/** Requires the one fixed preview backup bucket binding. */
function validBucket(buckets: readonly unknown[]): boolean {
  return (
    buckets.length === 1 &&
    exactOwnRecord(buckets[0], {
      binding: "BACKUP_BUCKET",
      bucket_name: "vision-preview-backups",
    })
  );
}

/** Requires the exact preview Queue producer and bounded consumer policy. */
function validQueue(
  producers: readonly unknown[],
  consumers: readonly unknown[],
): boolean {
  return (
    producers.length === 1 &&
    exactOwnRecord(producers[0], {
      binding: "CALENDAR_SYNC_QUEUE",
      queue: "vision-calendar-sync",
    }) &&
    consumers.length === 1 &&
    exactOwnRecord(consumers[0], {
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_concurrency: 1,
      max_retries: 5,
      queue: "vision-calendar-sync",
    })
  );
}

/** Checks exact simple object keys without invoking accessors. */
function exactOwnRecord(
  candidate: unknown,
  expected: Readonly<Record<string, string | number>>,
): boolean {
  if (!isPlainDataObject(candidate)) return false;
  const actual = candidate as Readonly<Record<string, unknown>>;
  const keys = Reflect.ownKeys(actual);
  const expectedKeys = Object.keys(expected).sort();
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== expectedKeys.length ||
    Object.keys(actual).sort().some((key, index) => key !== expectedKeys[index])
  ) {
    return false;
  }
  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return (
      descriptor?.enumerable === true &&
      "value" in descriptor &&
      descriptor.value === expected[key]
    );
  });
}

/** Reads one own enumerable data property without invoking accessors. */
function ownDataValue(
  value: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

/** Reads one recognized explicit provider binding array and rejects ambiguity. */
function readProviderBindings(settingsResponse: unknown): readonly unknown[] | undefined {
  if (!isPlainDataObject(settingsResponse)) return undefined;
  if (ownDataValue(settingsResponse, "success") !== true) return undefined;
  const result = ownDataValue(settingsResponse, "result");
  if (!isPlainDataObject(result)) return undefined;

  const hasDirect = Object.hasOwn(result, "bindings");
  const nestedSettings = ownDataValue(result, "settings");
  const hasNested =
    isPlainDataObject(nestedSettings) &&
    Object.hasOwn(nestedSettings, "bindings");
  if (hasDirect === hasNested) return undefined;

  const bindings = hasDirect
    ? ownDataValue(result, "bindings")
    : ownDataValue(nestedSettings as Readonly<Record<string, unknown>>, "bindings");
  return Array.isArray(bindings) ? bindings : undefined;
}

/** Rejects arrays, null, class instances, and accessor-bearing prototypes. */
function isPlainDataObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Reads and validates the normal artifact produced by the Cloudflare Vite build. */
async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const providerMode = arguments_[0] === "--verify-provider-state";
  const restoreProviderMode =
    arguments_[0] === "--verify-restore-pair-provider-state";
  try {
    if (providerMode || restoreProviderMode) {
      if (arguments_.length !== 4) throw new Error(INVALID_PROVIDER_STATE);
      const [healthResponse, schedulesResponse, settingsResponse] =
        await Promise.all(
          arguments_.slice(1).map(async (path) =>
            JSON.parse(await readFile(resolve(path), "utf8")),
          ),
        );
      const input = {
        healthResponse,
        schedulesResponse,
        settingsResponse,
      };
      if (restoreProviderMode) validateTemporaryRestorePairProviderState(input);
      else validateNormalPreviewProviderState(input);
      process.stdout.write("Normal preview provider state is valid.\n");
      return;
    }
    if (arguments_.length !== 0) throw new Error(INVALID_NORMAL);
    const serialized = await readFile(
      resolve("dist/vision/wrangler.json"),
      "utf8",
    );
    validatePreviewDeployConfig(JSON.parse(serialized));
  } catch {
    process.stderr.write(
      `${restoreProviderMode ? INVALID_RESTORE_PROVIDER_STATE : providerMode ? INVALID_PROVIDER_STATE : INVALID_NORMAL}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
