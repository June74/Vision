import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
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

describe("protected release evidence", () => {
  it.each(
    [
      "dist/client/assets/app.js",
      "dist/release-evidence/application-logs/captured.ndjson",
      "dist/release-evidence/audit/audit.ndjson",
      "dist/release-evidence/queue/queue.ndjson",
      "dist/release-evidence/database-raw/rows.ndjson",
      "dist/release-evidence/r2-unencrypted/object.json",
    ].flatMap((relativePath) => [
      [relativePath, "plain", PROTECTED_SENTINEL],
      [relativePath, "URL encoded", encodeURIComponent(PROTECTED_SENTINEL)],
      [
        relativePath,
        "fully percent encoded",
        [...Buffer.from(PROTECTED_SENTINEL, "utf8")]
          .map((byte) =>
            `%${byte.toString(16).padStart(2, "0").toUpperCase()}`)
          .join(""),
      ],
      [
        relativePath,
        "lowercase fully percent encoded",
        [...Buffer.from(PROTECTED_SENTINEL, "utf8")]
          .map((byte) =>
            `%${byte.toString(16).padStart(2, "0").toLowerCase()}`)
          .join(""),
      ],
      [
        relativePath,
        "base64",
        Buffer.from(PROTECTED_SENTINEL, "utf8").toString("base64"),
      ],
      [
        relativePath,
        "base64url",
        Buffer.from(PROTECTED_SENTINEL, "utf8").toString("base64url"),
      ],
    ]),
  )("rejects %s containing the %s protected sentinel variant", async (
    relativePath,
    _label,
    contamination,
  ) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      relativePath,
      contamination,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "protected-value" }),
      ]),
    );
  });

  it("fails closed when an expected evidence surface is absent", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await rm(`${root}/dist/release-evidence/queue`, {
      recursive: true,
      force: true,
    });

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: "dist/release-evidence/queue/queue.ndjson",
        }),
      ]),
    );
  });

  it("does not accept a junk file in place of the named capture", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await rm(
      `${root}/dist/release-evidence/application-logs/captured.ndjson`,
      { force: true },
    );
    await writeFixtureFile(
      root,
      "dist/release-evidence/application-logs/junk.ndjson",
      '{"status":"clean"}\n',
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file:
            "dist/release-evidence/application-logs/captured.ndjson",
        }),
      ]),
    );
  });

  it("rejects named evidence with empty provenance", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/release-evidence/queue/queue.ndjson",
      `${JSON.stringify({
        evidenceVersion: 1,
        surface: "queue",
        capturedAt: "2026-07-25T00:00:00.000Z",
        provenance: { generator: "", runId: "", source: "" },
        record: {},
      })}\n`,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "missing-evidence" }),
      ]),
    );
  });

  it("rejects self-asserted provenance outside the named fixture contract", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/release-evidence/queue/queue.ndjson",
      `${JSON.stringify({
        evidenceVersion: 1,
        surface: "queue",
        capturedAt: "2026-07-25T00:00:00.000Z",
        provenance: {
          generator: "unreviewed-generator",
          runId: "unreviewed-run",
          source: "unreviewed-source",
        },
        record: {},
      })}\n`,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "missing-evidence" }),
      ]),
    );
  });

  it("rejects evidence whose build digest is not bound to the current client build", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "dist/client/assets/app.js",
      "globalThis.__VISION_RELEASE_BUILD__ = 'changed-after-capture';",
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: "dist/release-evidence/manifest.json",
        }),
      ]),
    );
  });

  it("rejects evidence that is not freshly captured", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    const manifestPath = "dist/release-evidence/manifest.json";
    const manifest = JSON.parse(
      await readFile(join(root, ...manifestPath.split("/")), "utf8"),
    ) as Record<string, unknown>;
    await writeFixtureFile(
      root,
      manifestPath,
      JSON.stringify({ ...manifest, capturedAt: "2020-01-01T00:00:00.000Z" }),
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: manifestPath,
        }),
      ]),
    );
  });

  it("never reflects a protected or unsafe filename into a finding", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      `dist/client/assets/${PROTECTED_SENTINEL}.js`,
      PROTECTED_SENTINEL,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });
    const finding = result.violations.find(
      ({ category }) => category === "protected-value",
    );

    expect(finding?.file).toMatch(/^unsafe-path-[a-f0-9]{16}$/u);
    expect(finding?.file).not.toContain(PROTECTED_SENTINEL);
  });
});
