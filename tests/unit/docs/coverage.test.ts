import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDocumentationCoverage } from "../../../scripts/validate-doc-coverage";

const fixtureRoot = fileURLToPath(new URL("../../fixtures/doc-coverage", import.meta.url));
const exclusionsFixtureRoot = fileURLToPath(new URL("../../fixtures/doc-coverage-exclusions", import.meta.url));
const apiShapesFixtureRoot = fileURLToPath(new URL("../../fixtures/doc-coverage-api-shapes", import.meta.url));

describe("validateDocumentationCoverage", () => {
  it("reports an undocumented production function with its source path and name", () => {
    const violations = validateDocumentationCoverage(fixtureRoot);

    expect(violations).toContain("src/features/calendar/undocumented.ts: undocumentedFunction is missing JSDoc");
    expect(violations).toContain("src/features: missing simple folder guide");
  });

  it("excludes fixtures and configuration files without excluding production source files", () => {
    const violations = validateDocumentationCoverage(exclusionsFixtureRoot);

    expect(violations).toContain("src/active.ts: activeProductionFunction is missing JSDoc");
    expect(violations).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("src/fixtures/ignored.ts"),
        expect.stringContaining("scripts/fixtures/ignored.ts"),
        expect.stringContaining("src/build.config.ts"),
        expect.stringContaining("scripts/release.config.ts"),
      ]),
    );
  });

  it("reports named object-property and class-field functions without JSDoc", () => {
    const violations = validateDocumentationCoverage(apiShapesFixtureRoot);

    expect(violations).toContain("src/api-shapes.ts: objectPropertyFunction is missing JSDoc");
    expect(violations).toContain("src/api-shapes.ts: classFieldFunction is missing JSDoc");
  });

  it("does not accept function JSDoc as module documentation", () => {
    const violations = validateDocumentationCoverage(apiShapesFixtureRoot);

    expect(violations).toContain("src/function-jsdoc-only.ts: missing module JSDoc");
  });
});
