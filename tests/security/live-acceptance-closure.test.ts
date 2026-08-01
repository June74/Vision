import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLOSURE_FILES = [
  ".superpowers/sdd/live-acceptance-runbook-audit.md",
  ".superpowers/sdd/fault-cleanup-plan-map-report.md",
  "docs/operations/environments.md",
  "docs/operations/incident-runbook.md",
  "docs/operations/cost-review.md",
] as const;

const ORDERED_ANCHORS = [
  "reviewed Task 9 cleanup is deployed",
  "normal health, signed-in reads, exactly two schedules, and temporary absence are proved",
  "disposable branch deletion and absence are proved",
  "replay marker is deleted last",
] as const;

async function read(relativePath: string): Promise<string> {
  return readFile(resolve(process.cwd(), relativePath), "utf8");
}

describe("permanent live-acceptance closure policy", () => {
  it.each(CLOSURE_FILES)("keeps %s in the reviewed cleanup order", async (path) => {
    const source = await read(path);
    const positions = ORDERED_ANCHORS.map((anchor) => source.indexOf(anchor));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(source).toContain("Provider deletion is manual");
    expect(source).toContain("No workflow receives a deletion operation");
  });

  it("keeps provider deletion out of the preview workflow interface", async () => {
    const workflow = await read(".github/workflows/preview.yml");

    expect(workflow).not.toMatch(/delete_(?:provider|branch|marker|database|r2)/u);
    expect(workflow).not.toMatch(/operation:\s*(?:delete|provider_cleanup)/u);
  });
});
