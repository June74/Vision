import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TEST_PROVIDER_BOUNDARY_MARKER,
  validateProductionCryptoBoundary,
} from "../../../scripts/validate-production-crypto-boundary";

describe("production crypto build boundary", () => {
  it("keeps the test provider unreachable from production source and absent from the Worker bundle", () => {
    expect(validateProductionCryptoBoundary(resolve(import.meta.dirname, "../../.."))).toEqual([]);
    expect(TEST_PROVIDER_BOUNDARY_MARKER).toMatch(/TEST_PROVIDER/u);
  });
});
