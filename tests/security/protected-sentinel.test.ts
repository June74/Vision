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

describe("protected release evidence", () => {
  it.each(
    [
      "application-logs/captured.ndjson",
      "audit/audit.ndjson",
      "queue/queue.ndjson",
      "database-raw/rows.ndjson",
      "r2-unencrypted/object.json",
    ].flatMap((surface) => [
      [surface, "plain", PROTECTED_SENTINEL],
      [surface, "URL encoded", encodeURIComponent(PROTECTED_SENTINEL)],
      [
        surface,
        "base64",
        Buffer.from(PROTECTED_SENTINEL, "utf8").toString("base64"),
      ],
    ]),
  )("rejects %s containing the %s protected sentinel variant", async (
    surface,
    _label,
    contamination,
  ) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      `tests/fixtures/release-evidence/${surface}`,
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
    await rm(`${root}/tests/fixtures/release-evidence/queue`, {
      recursive: true,
      force: true,
    });

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing-evidence",
          file: "tests/fixtures/release-evidence/queue",
        }),
      ]),
    );
  });
});
