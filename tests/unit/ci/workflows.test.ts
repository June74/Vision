import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Reads a committed workflow from the repository root. */
async function readWorkflow(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), ".github", "workflows", name), "utf8");
}

/** Reads the package metadata without adding a YAML parser dependency to policy tests. */
async function readPackage(): Promise<{ packageManager?: string }> {
  const contents = await readFile(resolve(process.cwd(), "package.json"), "utf8");
  return JSON.parse(contents) as { packageManager?: string };
}

describe("delivery workflow policy", () => {
  it("keeps checks, previews, and production releases safely separated", async () => {
    const [ci, preview, production, packageMetadata] = await Promise.all([
      readWorkflow("ci.yml"),
      readWorkflow("preview.yml"),
      readWorkflow("production.yml"),
      readPackage(),
    ]);

    expect(packageMetadata.packageManager).toBe("pnpm@11.9.0");

    expect(ci).toContain("pull_request:");
    expect(ci).toContain("pnpm install --frozen-lockfile");
    expect(ci).toContain("pnpm check");
    expect(ci).toContain("pnpm test:e2e");
    expect(ci).toContain("permissions:\n  contents: read");

    expect(preview).toContain("workflow_dispatch:");
    expect(preview).not.toContain("push:");
    expect(preview).not.toContain("production");
    expect(preview).toContain("environment: preview");
    expect(preview).not.toContain("if: ${{ secrets.");
    expect(preview).toContain("id: preview-token");
    expect(preview).toContain('echo "## Preview deployment blocked" >> "$GITHUB_STEP_SUMMARY"');
    expect(preview).toContain("exit 1");
    expect(preview).toContain("outputs:\n      verified_sha:");
    expect(preview).toContain("id: verified-ref");
    expect(preview).toContain("git rev-parse HEAD");
    expect(preview).toContain("ref: ${{ needs.verify.outputs.verified_sha }}");
    expect(preview).toContain("permissions:\n  contents: read");

    expect(production).toContain("workflow_dispatch:");
    expect(production).toContain("environment: production");
    expect(production).not.toContain("pull_request:");
    expect(production).not.toContain("push:");
    expect(production).toContain("confirmation:");
    expect(production).toContain("DEPLOY VISION PRODUCTION");
    expect(production).toContain("needs: confirm");
    expect(production).toContain("needs: [confirm, verify]");
    expect(production).toContain("if: ${{ needs.confirm.outputs.confirmed == 'true' && needs.verify.result == 'success' }}");
    expect(production).toContain("outputs:\n      verified_sha:");
    expect(production).toContain("id: verified-ref");
    expect(production).toContain("git rev-parse HEAD");
    expect(production).toContain("ref: ${{ needs.verify.outputs.verified_sha }}");
    expect(production).toContain("permissions:\n  contents: read");
  });
});
