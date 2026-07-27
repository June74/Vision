/** Rejects generated deploy artifacts that do not contain the isolated preview backup binding. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface PreviewDeployConfig {
  readonly targetEnvironment?: unknown;
  readonly vars?: unknown;
  readonly queues?: unknown;
  readonly triggers?: unknown;
  readonly r2_buckets?: unknown;
}

/** Enforces the exact preview environment and backup bucket in the generated artifact. */
export function validatePreviewDeployConfig(candidate: unknown): void {
  const config =
    candidate !== null && typeof candidate === "object"
      ? (candidate as PreviewDeployConfig)
      : {};
  const vars =
    config.vars !== null && typeof config.vars === "object"
      ? (config.vars as Readonly<Record<string, unknown>>)
      : {};
  const buckets = Array.isArray(config.r2_buckets)
    ? config.r2_buckets
    : [];
  const queues =
    config.queues !== null && typeof config.queues === "object"
      ? (config.queues as Readonly<Record<string, unknown>>)
      : {};
  const producers = Array.isArray(queues.producers)
    ? queues.producers
    : [];
  const consumers = Array.isArray(queues.consumers)
    ? queues.consumers
    : [];
  const triggers =
    config.triggers !== null && typeof config.triggers === "object"
      ? (config.triggers as Readonly<Record<string, unknown>>)
      : {};
  const crons = Array.isArray(triggers.crons) ? triggers.crons : [];
  const validBucket =
    buckets.length === 1 &&
    buckets[0] !== null &&
    typeof buckets[0] === "object" &&
    (buckets[0] as Record<string, unknown>).binding === "BACKUP_BUCKET" &&
    (buckets[0] as Record<string, unknown>).bucket_name ===
      "vision-preview-backups";
  const validQueue =
    producers.length === 1 &&
    producers[0] !== null &&
    typeof producers[0] === "object" &&
    (producers[0] as Record<string, unknown>).binding ===
      "CALENDAR_SYNC_QUEUE" &&
    (producers[0] as Record<string, unknown>).queue ===
      "vision-calendar-sync" &&
    consumers.length === 1 &&
    consumers[0] !== null &&
    typeof consumers[0] === "object" &&
    (consumers[0] as Record<string, unknown>).queue ===
      "vision-calendar-sync" &&
    (consumers[0] as Record<string, unknown>).max_batch_size === 10 &&
    (consumers[0] as Record<string, unknown>).max_batch_timeout === 5 &&
    (consumers[0] as Record<string, unknown>).max_retries === 5 &&
    (consumers[0] as Record<string, unknown>).max_concurrency === 1;
  const validCrons =
    crons.length === 3 &&
    crons[0] === "*/15 * * * *" &&
    crons[1] === "5 6 * * *" &&
    crons[2] === "* * * * *";
  if (
    config.targetEnvironment !== "preview" ||
    vars.VISION_ENV !== "preview" ||
    vars.AI_MONTHLY_HARD_LIMIT_CENTS !== "950" ||
    vars.BACKUP_KEY_VERSION !== "1" ||
    vars.GOOGLE_REDIRECT_URI !==
      "https://vision-preview.june74.workers.dev/api/auth/google/callback" ||
    Object.hasOwn(vars, "BACKUP_ENCRYPTION_KEY") ||
    !validQueue ||
    !validCrons ||
    !validBucket
  ) {
    throw new Error("Preview deployment configuration is invalid.");
  }
}

/** Reads and validates the artifact produced by the Cloudflare Vite build. */
async function main(): Promise<void> {
  try {
    const serialized = await readFile(
      resolve("dist/vision/wrangler.json"),
      "utf8",
    );
    validatePreviewDeployConfig(JSON.parse(serialized));
  } catch {
    process.stderr.write("Preview deployment configuration is invalid.\n");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
