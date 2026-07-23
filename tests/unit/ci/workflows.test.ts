import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Reads a committed workflow from the repository root. */
async function readWorkflow(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), ".github", "workflows", name), "utf8");
}

describe("delivery workflow policy", () => {
  it("keeps checks, previews, and production releases safely separated", async () => {
    const [ci, preview, production] = await Promise.all([
      readWorkflow("ci.yml"),
      readWorkflow("preview.yml"),
      readWorkflow("production.yml"),
    ]);

    expect(ci).toContain("pull_request:");
    expect(ci).toContain("pnpm install --frozen-lockfile");
    expect(ci).toContain("pnpm check");
    expect(ci).toContain("pnpm test:e2e");

    expect(preview).toContain("workflow_dispatch:");
    expect(preview).not.toContain("push:");
    expect(preview).not.toContain("production");
    expect(preview).toContain("environment: preview");
    expect(preview).not.toContain("if: ${{ secrets.");
    expect(preview).toContain("id: preview-token");
    expect(preview).toContain("if: ${{ steps.preview-token.outputs.deploy == 'true' }}");

    expect(production).toContain("workflow_dispatch");
    expect(production).toContain("environment: production");
    expect(production).not.toContain("pull_request:");
    expect(production).not.toContain("push:");
  });
});
