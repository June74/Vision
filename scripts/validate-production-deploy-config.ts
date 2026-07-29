/** Validates the explicit generated production deployment artifact. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INVALID = "Production deployment configuration is invalid.";
const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;
const EXPECTED_VAR_NAMES = [
  "AI_MONTHLY_HARD_LIMIT_CENTS",
  "BACKUP_KEY_VERSION",
  "DATABASE_USAGE_WARNING_BYTES",
  "R2_USAGE_WARNING_BYTES",
  "R2_USAGE_WARNING_OBJECTS",
  "VISION_ENV",
] as const;

/** Enforces production isolation, normal schedules, and the closed variable shape. */
export function validateProductionDeployConfig(candidate: unknown): void {
  const config = plainObject(candidate);
  const queues = plainObject(config?.queues);
  const producers = Array.isArray(queues?.producers) ? queues.producers : [];
  const consumers = Array.isArray(queues?.consumers) ? queues.consumers : [];
  const triggers = plainObject(config?.triggers);
  const crons = Array.isArray(triggers?.crons) ? triggers.crons : [];
  const buckets = Array.isArray(config?.r2_buckets) ? config.r2_buckets : [];
  const vars = plainObject(config?.vars);

  if (
    config?.targetEnvironment !== "production" ||
    !exactArray(crons, NORMAL_CRONS) ||
    !exactRecord(producers[0], {
      binding: "CALENDAR_SYNC_QUEUE",
      queue: "vision-production-calendar-sync",
    }) ||
    producers.length !== 1 ||
    !exactRecord(consumers[0], {
      queue: "vision-production-calendar-sync",
      max_batch_size: 10,
      max_batch_timeout: 5,
      max_retries: 5,
      max_concurrency: 1,
    }) ||
    consumers.length !== 1 ||
    !exactRecord(buckets[0], {
      binding: "BACKUP_BUCKET",
      bucket_name: "vision-production-backups",
    }) ||
    buckets.length !== 1 ||
    !validProductionVars(vars)
  ) {
    throw new Error(INVALID);
  }
}

/** Requires exactly the approved names and canonical nonnegative decimal values. */
function validProductionVars(
  vars: Record<string, unknown> | undefined,
): boolean {
  if (vars === undefined) return false;
  const keys = Object.keys(vars).sort();
  const expectedKeys = [...EXPECTED_VAR_NAMES].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    vars.VISION_ENV !== "production"
  ) {
    return false;
  }
  return expectedKeys
    .filter((name) => name !== "VISION_ENV")
    .every((name) => {
      const value = vars[name];
      return typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value);
    });
}

/** Requires one exact array without coercion. */
function exactArray(
  actual: readonly unknown[],
  expected: readonly unknown[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

/** Requires one exact own enumerable record without invoking accessors. */
function exactRecord(
  candidate: unknown,
  expected: Readonly<Record<string, string | number>>,
): boolean {
  const actual = plainObject(candidate);
  if (actual === undefined) return false;
  const keys = Reflect.ownKeys(actual);
  const expectedKeys = Object.keys(expected).sort();
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => typeof key === "string") &&
    Object.keys(actual)
      .sort()
      .every((key, index) => key === expectedKeys[index]) &&
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

/** Returns only ordinary data records. */
function plainObject(value: unknown): Record<string, unknown> | undefined {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    ? value as Record<string, unknown>
    : undefined;
}

/** Validates only the generated production artifact at its fixed path. */
async function main(): Promise<void> {
  try {
    if (process.argv.length !== 2) throw new Error(INVALID);
    const serialized = await readFile(
      resolve("dist/vision/wrangler.json"),
      "utf8",
    );
    validateProductionDeployConfig(JSON.parse(serialized));
    process.stdout.write("Production deployment configuration is valid.\n");
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
