import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import { createUsageWarningSource } from "../../../src/data/usage-warning-source";
import type { UsageWarningThresholds } from "../../../src/domain/operations/usage-warnings";

const dialect = new PgDialect();
const thresholds: UsageWarningThresholds = {
  databaseBytes: 400_000_000,
  r2Bytes: 8_000_000_000,
  r2ObjectCount: 100,
};

function databaseReturning(databaseBytes: unknown): VisionDatabase {
  return {
    execute: vi.fn(async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      expect(query.sql.toLowerCase()).toMatch(
        /^select pg_database_size\(current_database\(\)\) as "databasebytes"$/u,
      );
      expect(query.sql.toLowerCase()).not.toMatch(
        /\b(?:insert|update|delete|alter|drop|create)\b/u,
      );
      return { rows: [{ databaseBytes }] };
    }),
  } as unknown as VisionDatabase;
}

function object(size: unknown): R2Object {
  return { size } as unknown as R2Object;
}

function bucketListing(
  implementation: R2Bucket["list"],
): R2Bucket {
  return { list: implementation } as unknown as R2Bucket;
}

describe("usage warning source", () => {
  it("reads the database aggregate and paginates only the fixed backup prefix", async () => {
    const list = vi
      .fn<R2Bucket["list"]>()
      .mockResolvedValueOnce({
        objects: [object(4_000_000_000)],
        truncated: true,
        cursor: "opaque-page-2",
      } as R2Objects)
      .mockResolvedValueOnce({
        objects: [object(4_000_000_000)],
        truncated: false,
      } as R2Objects);
    const source = createUsageWarningSource(
      databaseReturning("400000000"),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: true,
      r2UsageWarning: true,
    });
    expect(list).toHaveBeenNthCalledWith(1, {
      prefix: "backups/v1/",
      limit: 100,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: "backups/v1/",
      limit: 100,
      cursor: "opaque-page-2",
    });
  });

  it("preserves the successful R2 measurement when the database measurement fails", async () => {
    const database = {
      execute: vi.fn(async () => {
        throw new Error("PRIVATE_DATABASE_PROVIDER_ERROR");
      }),
    } as unknown as VisionDatabase;
    const source = createUsageWarningSource(
      database,
      bucketListing(vi.fn(async () => ({
        objects: [object(1)],
        truncated: false,
      } as R2Objects))),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: true,
      r2UsageWarning: false,
    });
  });

  it("preserves the successful database measurement when R2 fails without leaking provider detail", async () => {
    const privateError = "PRIVATE_R2_KEY_CURSOR_METADATA_PROVIDER_ERROR";
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(vi.fn(async () => {
        throw new Error(privateError);
      })),
      thresholds,
    );

    const warnings = await source.readUsageWarnings();

    expect(warnings).toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(JSON.stringify(warnings)).not.toContain(privateError);
  });

  it.each([
    ["negative database bytes", -1, false],
    ["fractional database bytes", 1.5, false],
    ["unsafe database bytes", Number.MAX_SAFE_INTEGER + 1, false],
    ["missing database row", undefined, true],
  ])("fails the database warning safe for %s", async (_, value, missingRow) => {
    const database = {
      execute: vi.fn(async () => ({
        rows: missingRow ? [] : [{ databaseBytes: value }],
      })),
    } as unknown as VisionDatabase;
    const source = createUsageWarningSource(
      database,
      bucketListing(vi.fn(async () => ({
        objects: [],
        delimitedPrefixes: [],
        truncated: false,
      } as R2Objects))),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: true,
      r2UsageWarning: false,
    });
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("fails the R2 warning safe for a %s object size", async (_, size) => {
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(vi.fn(async () => ({
        objects: [object(size)],
        truncated: false,
      } as R2Objects))),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
  });

  it("fails R2 safe before overflowing byte aggregation", async () => {
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(vi.fn(async () => ({
        objects: [
          object(Number.MAX_SAFE_INTEGER - 10),
          object(11),
        ],
        truncated: false,
      } as R2Objects))),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
  });

  it("fails R2 safe on a repeated cursor", async () => {
    const list = vi.fn(async () => ({
      objects: [],
      delimitedPrefixes: [],
      truncated: true,
      cursor: "repeated",
    } as R2Objects));
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("fails R2 safe when one provider page exceeds the direct object cap", async () => {
    const list = vi.fn(async () => ({
      objects: Array.from({ length: 101 }, () => object(0)),
      delimitedPrefixes: [],
      truncated: false,
    } as R2Objects));
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(list).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["overlong", "x".repeat(2_049)],
  ])("fails R2 safe for a %s truncated cursor", async (_label, cursor) => {
    const list = vi.fn(async () => ({
      objects: [],
      delimitedPrefixes: [],
      truncated: true,
      ...(cursor === undefined ? {} : { cursor }),
    } as R2Objects));
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(list).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, 0, 1, "false"])(
    "fails R2 safe when truncated is not boolean: %s",
    async (truncated) => {
      const source = createUsageWarningSource(
        databaseReturning(1),
        bucketListing(vi.fn(async () => ({
          objects: [],
          delimitedPrefixes: [],
          truncated,
        } as unknown as R2Objects))),
        thresholds,
      );

      await expect(source.readUsageWarnings()).resolves.toEqual({
        databaseUsageWarning: false,
        r2UsageWarning: true,
      });
    },
  );

  it("fails R2 safe when pagination exceeds the fixed page cap", async () => {
    let page = 0;
    const list = vi.fn(async () => ({
      objects: [],
      delimitedPrefixes: [],
      truncated: true,
      cursor: `cursor-${++page}`,
    } as R2Objects));
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(list.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("caps admitted objects once the warning boundary is proven", async () => {
    const list = vi.fn(async () => ({
      objects: Array.from({ length: 100 }, () => object(0)),
      truncated: true,
      cursor: "must-not-be-returned",
      delimitedPrefixes: ["must-not-be-returned"],
    } as unknown as R2Objects));
    const source = createUsageWarningSource(
      databaseReturning(1),
      bucketListing(list),
      thresholds,
    );

    await expect(source.readUsageWarnings()).resolves.toEqual({
      databaseUsageWarning: false,
      r2UsageWarning: true,
    });
    expect(list).toHaveBeenCalledOnce();
  });
});
