import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TEST_PROVIDER_BOUNDARY_MARKER,
  validateProductionCryptoBoundary,
} from "../../../scripts/validate-production-crypto-boundary";

describe("production crypto build boundary", () => {
  it("keeps test-only key and authorization issuers unreachable from production source and bundles", () => {
    expect(validateProductionCryptoBoundary(resolve(import.meta.dirname, "../../.."))).toEqual([]);
    expect(TEST_PROVIDER_BOUNDARY_MARKER).toMatch(/TEST_PROVIDER/u);
  });

  it("keeps deletion implementations private to their capability-validating factories", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../../src/data/repositories/deletion-repository.ts"),
      "utf8",
    );
    expect(source).not.toContain("export class DrizzleDeletionRepository");
    expect(source).not.toContain("export class DrizzleDeletionPurgeRepository");
  });
});
