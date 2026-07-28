/** Measures database and backup storage through bounded, read-only provider calls. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "./db";
import {
  calculateUsageWarnings,
  type UsageMeasurements,
  type UsageWarnings,
  type UsageWarningSource,
  type UsageWarningThresholds,
} from "../domain/operations/usage-warnings";
import { BACKUP_OBJECT_PREFIX } from "../jobs/create-daily-backup";

const R2_LIST_PAGE_LIMIT = 100;
const MAX_R2_LIST_PAGES = 10;

type DatabaseSizeRow = Record<string, unknown>;

/** Creates one fail-safe source over the canonical database and private backup bucket. */
export function createUsageWarningSource(
  database: VisionDatabase,
  bucket: R2Bucket,
  thresholds: UsageWarningThresholds,
): UsageWarningSource {
  // Validate threshold configuration before any provider call.
  calculateUsageWarnings(
    { databaseBytes: 0, r2ObjectCount: 0, r2Bytes: 0 },
    thresholds,
  );
  if (!bucket || typeof bucket.list !== "function") {
    throw new Error("Usage warning source is unavailable.");
  }

  return Object.freeze({
    /** Measures both providers independently and converts unavailable input to actionable warnings. */
    async readUsageWarnings(): Promise<UsageWarnings> {
      const [databaseResult, r2Result] = await Promise.allSettled([
        readDatabaseBytes(database),
        readR2Measurements(bucket, thresholds),
      ]);
      const measurements: UsageMeasurements = {
        databaseBytes:
          databaseResult.status === "fulfilled"
            ? databaseResult.value
            : thresholds.databaseBytes,
        ...(r2Result.status === "fulfilled"
          ? r2Result.value
          : { r2ObjectCount: thresholds.r2ObjectCount, r2Bytes: 0 }),
      };
      return calculateUsageWarnings(measurements, thresholds);
    },
  });
}

/** Reads one content-free PostgreSQL database-size aggregate. */
async function readDatabaseBytes(database: VisionDatabase): Promise<number> {
  const result = await database.execute<DatabaseSizeRow>(
    sql`select pg_database_size(current_database()) as "databaseBytes"`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Database usage measurement is unavailable.");
  return decodeDatabaseBytes(row.databaseBytes);
}

/** Lists the fixed backup namespace with bounded progress and identity-free aggregation. */
async function readR2Measurements(
  bucket: R2Bucket,
  thresholds: UsageWarningThresholds,
): Promise<Pick<UsageMeasurements, "r2ObjectCount" | "r2Bytes">> {
  let cursor: string | undefined;
  let r2ObjectCount = 0;
  let r2Bytes = 0;
  const observedCursors = new Set<string>();

  for (let pageNumber = 0; pageNumber < MAX_R2_LIST_PAGES; pageNumber += 1) {
    const page = await bucket.list({
      prefix: BACKUP_OBJECT_PREFIX,
      limit: R2_LIST_PAGE_LIMIT,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (!Array.isArray(page.objects) || page.objects.length > R2_LIST_PAGE_LIMIT) {
      throw new Error("R2 usage measurement is unavailable.");
    }
    if (typeof page.truncated !== "boolean") {
      throw new Error("R2 usage measurement is unavailable.");
    }

    for (const object of page.objects) {
      const size = object.size;
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error("R2 usage measurement is unavailable.");
      }
      if (
        r2ObjectCount === Number.MAX_SAFE_INTEGER ||
        size > Number.MAX_SAFE_INTEGER - r2Bytes
      ) {
        throw new Error("R2 usage measurement is unavailable.");
      }
      r2ObjectCount += 1;
      r2Bytes += size;
    }

    if (
      r2ObjectCount >= thresholds.r2ObjectCount ||
      r2Bytes >= thresholds.r2Bytes
    ) {
      return {
        r2ObjectCount: Math.min(r2ObjectCount, thresholds.r2ObjectCount),
        r2Bytes: Math.min(r2Bytes, thresholds.r2Bytes),
      };
    }
    if (!page.truncated) return { r2ObjectCount, r2Bytes };
    if (
      typeof page.cursor !== "string" ||
      page.cursor.length === 0 ||
      page.cursor.length > 2_048 ||
      observedCursors.has(page.cursor)
    ) {
      throw new Error("R2 usage measurement is unavailable.");
    }
    observedCursors.add(page.cursor);
    cursor = page.cursor;
  }

  throw new Error("R2 usage measurement is unavailable.");
}

/** Admits PostgreSQL bigint output only as a nonnegative safe integer. */
function decodeDatabaseBytes(value: unknown): number {
  const decoded =
    typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
      ? Number(value)
      : value;
  if (
    typeof decoded !== "number" ||
    !Number.isSafeInteger(decoded) ||
    decoded < 0
  ) {
    throw new Error("Database usage measurement is unavailable.");
  }
  return decoded;
}
