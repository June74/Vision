import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDocumentationCoverage } from "../../../scripts/validate-doc-coverage";

const fixtureRoot = fileURLToPath(new URL("../../fixtures/doc-coverage", import.meta.url));

describe("validateDocumentationCoverage", () => {
  it("reports an undocumented production function with its source path and name", () => {
    const violations = validateDocumentationCoverage(fixtureRoot);

    expect(violations).toContain("src/features/calendar/undocumented.ts: undocumentedFunction is missing JSDoc");
    expect(violations).toContain("src/features: missing simple folder guide");
  });
});
