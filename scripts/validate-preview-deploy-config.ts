/** Rejects generated deploy artifacts that do not contain the isolated preview backup binding. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface PreviewDeployConfig {
  readonly targetEnvironment?: unknown;
  readonly vars?: unknown;
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
  const validBucket =
    buckets.length === 1 &&
    buckets[0] !== null &&
    typeof buckets[0] === "object" &&
    (buckets[0] as Record<string, unknown>).binding === "BACKUP_BUCKET" &&
    (buckets[0] as Record<string, unknown>).bucket_name ===
      "vision-preview-backups";
  if (
    config.targetEnvironment !== "preview" ||
    vars.VISION_ENV !== "preview" ||
    vars.BACKUP_KEY_VERSION !== "1" ||
    Object.hasOwn(vars, "BACKUP_ENCRYPTION_KEY") ||
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
