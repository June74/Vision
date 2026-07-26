import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { captureReleaseEvidence } from "../../scripts/capture-release-evidence";
import { scanRelease } from "../../scripts/scan-release";
import {
  createCleanReleaseFixture,
  PROTECTED_SENTINEL,
} from "./release-test-fixture";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })),
  );
});

describe("generated release evidence", () => {
  it("captures fresh evidence through the real privacy boundaries", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);

    await captureReleaseEvidence(root);
    const result = await scanRelease({
      projectRoot: root,
      protectedSentinel: PROTECTED_SENTINEL,
    });

    expect(result.violations).toEqual([]);
  });
});
