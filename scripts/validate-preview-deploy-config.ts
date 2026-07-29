/** Validates immutable normal and generated acceptance preview deploy artifacts. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PreviewAcceptanceSelector } from "./prepare-preview-acceptance-deploy-config";

const INVALID_NORMAL = "Preview deployment configuration is invalid.";
const INVALID_ACCEPTANCE =
  "Preview acceptance deployment configuration is invalid.";
const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;
const ACCEPTANCE_CRON = "* * * * *";
const NORMAL_VAR_ENTRIES = Object.freeze({
  AI_MONTHLY_HARD_LIMIT_CENTS: "950",
  BACKUP_KEY_VERSION: "1",
  DATABASE_USAGE_WARNING_BYTES: "400000000",
  GOOGLE_REDIRECT_URI:
    "https://vision-preview.june74.workers.dev/api/auth/google/callback",
  R2_USAGE_WARNING_BYTES: "8000000000",
  R2_USAGE_WARNING_OBJECTS: "100",
  VISION_ENV: "preview",
});
const ACCEPTANCE_SELECTORS = new Set([
  "queue_delayed",
  "job_failed",
  "channel_expired",
  "database_unavailable",
  "r2_upload_failed",
  "ai_stopped",
  "foundation_probe",
  "ai_usage",
]);

/** Flattened Cloudflare Vite output used by normal and acceptance deployments. */
export interface PreviewDeployConfig {
  readonly targetEnvironment?: unknown;
  readonly vars?: unknown;
  readonly queues?: unknown;
  readonly triggers?: unknown;
  readonly r2_buckets?: unknown;
  readonly [key: string]: unknown;
}

/** Enforces the exact immutable normal preview environment artifact. */
export function validatePreviewDeployConfig(candidate: unknown): void {
  validate(candidate, undefined, INVALID_NORMAL);
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
    expectedSelector === undefined
      ? NORMAL_CRONS
      : [...NORMAL_CRONS, ACCEPTANCE_CRON];
  const expectedVars: Readonly<Record<string, string>> = {
    ...NORMAL_VAR_ENTRIES,
    ...(expectedSelector === undefined
      ? {}
      : { PREVIEW_ACCEPTANCE_SCENARIO: expectedSelector }),
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
  try {
    const serialized = await readFile(
      resolve("dist/vision/wrangler.json"),
      "utf8",
    );
    validatePreviewDeployConfig(JSON.parse(serialized));
  } catch {
    process.stderr.write(`${INVALID_NORMAL}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
