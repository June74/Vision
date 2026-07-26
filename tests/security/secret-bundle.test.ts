import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { scanRelease } from "../../scripts/scan-release";
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
  it.each([
    "BACKUP_ENCRYPTION_KEY",
    "CLOUDFLARE_API_TOKEN",
    "DATABASE_URL",
    "GOOGLE_ALLOWED_EMAIL",
    "GOOGLE_CLIENT_SECRET",
    "KEY_ENCRYPTION_KEY",
  ])("rejects server-only binding %s in a built client asset", async (binding) => {
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
});
