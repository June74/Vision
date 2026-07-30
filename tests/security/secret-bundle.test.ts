import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { scanRelease } from "../../scripts/scan-release";
import {
  CLIENT_FORBIDDEN_BINDING_NAMES,
  CLIENT_FORBIDDEN_RUNTIME_VALUES,
  CLIENT_SAFE_RUNTIME_BINDING_NAMES,
  RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES,
} from "../../src/server/client-binding-boundary";
import { TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS } from "../../src/domain/operations/temporary-preview-fault";
import { RuntimeEnvSchema } from "../../src/server/env";
import {
  createCleanReleaseFixture,
  PROTECTED_SENTINEL,
  writeFixtureFile,
} from "./release-test-fixture";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("client secret-bundle boundary", () => {
  it("keeps current-workflow role/restore selectors and temporary names server-only", () => {
    expect(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS).toContain("role_probe");
    expect(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS).toContain("restore");
    expect(CLIENT_FORBIDDEN_BINDING_NAMES).toContain(
      "PREVIEW_RESTORE_DATABASE_URL",
    );
    expect(CLIENT_FORBIDDEN_BINDING_NAMES).toContain(
      "PREVIEW_RESTORE_TARGET_ID",
    );
  });
  it.each(CLIENT_FORBIDDEN_BINDING_NAMES)(
    "rejects server-only binding %s in a built client asset",
    async (binding) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/client/assets/app.js",
      `globalThis.config = "${binding}";`,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "client-secret-binding",
          file: "dist/client/assets/app.js",
        }),
      ]),
    );
  });

  it("classifies every runtime binding when the environment schema changes", () => {
    const classified = new Set([
      ...RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES,
      ...CLIENT_SAFE_RUNTIME_BINDING_NAMES,
    ]);

    expect([...classified].sort()).toEqual(
      Object.keys(RuntimeEnvSchema.shape).sort(),
    );
    expect(CLIENT_FORBIDDEN_BINDING_NAMES).toContain("OPENAI_API_KEY");
    expect(RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES).toEqual(
      expect.arrayContaining([
        "DATABASE_USAGE_WARNING_BYTES",
        "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
        "PREVIEW_ACCEPTANCE_SCENARIO",
        "PREVIEW_RESTORE_DATABASE_URL",
        "PREVIEW_RESTORE_TARGET_ID",
        "R2_USAGE_WARNING_BYTES",
        "R2_USAGE_WARNING_OBJECTS",
      ]),
    );
  });

  it.each(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS)(
    "rejects preview activation value %s in a built client asset",
    async (scenario) => {
      const root = await createCleanReleaseFixture();
      roots.push(root);
      await writeFixtureFile(
        root,
        "dist/client/assets/app.js",
        `globalThis.previewScenario = "${scenario}";`,
      );

      const result = await scanRelease({
        projectRoot: root,
        protectedSentinel: PROTECTED_SENTINEL,
      });

      expect(CLIENT_FORBIDDEN_RUNTIME_VALUES).toContain(scenario);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "client-secret-binding",
            file: "dist/client/assets/app.js",
          }),
        ]),
      );
    },
  );

  it.each([
    ["temporary restore evidence", "temporary-restore-evidence-fixture"],
    ["temporary target identity", "temporary-target-identity-fixture"],
    ["fixture sentinel", "temporary-preview-fixture-sentinel"],
  ])("rejects a protected %s from built client assets", async (_, sentinel) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/client/assets/app.js",
      `globalThis.restoreFixture = "${sentinel}";`,
    );

    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: sentinel,
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "protected-value",
          file: "dist/client/assets/app.js",
        }),
      ]),
    );
  });

  it("fails closed when the built client assets are missing", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await rm(`${root}/dist/client`, { recursive: true, force: true });

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: "dist/client",
        }),
      ]),
    );
  });

  it("rejects a protected value from the Worker bundle", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/vision/index.js",
      `globalThis.restoreFixture = "${PROTECTED_SENTINEL}";`,
    );

    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: PROTECTED_SENTINEL,
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "protected-value",
          file: "dist/vision/index.js",
        }),
      ]),
    );
  });

  it("fails closed when the Worker bundle is missing", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await rm(`${root}/dist/vision`, { recursive: true, force: true });

    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: PROTECTED_SENTINEL,
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: "dist/vision",
        }),
      ]),
    );
  });

  it("allows server-only binding names in the Worker bundle", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/vision/index.js",
      'globalThis.restoreBinding = "PREVIEW_RESTORE_DATABASE_URL";',
    );

    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: PROTECTED_SENTINEL,
    });

    expect(result.violations).toEqual([]);
  });
});
