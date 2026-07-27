import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Reads a committed workflow from the repository root. */
async function readWorkflow(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), ".github", "workflows", name), "utf8");
}

/** Extracts one named workflow step without requiring a YAML runtime dependency. */
function readWorkflowStep(workflow: string, name: string): string {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  if (start === -1) {
    throw new Error(`Workflow step not found: ${name}`);
  }
  const nextStep = workflow.indexOf("\n      - ", start + marker.length);
  return workflow.slice(start, nextStep === -1 ? undefined : nextStep);
}

/** Reads the package metadata without adding a YAML parser dependency to policy tests. */
async function readPackage(): Promise<{ packageManager?: string }> {
  const contents = await readFile(resolve(process.cwd(), "package.json"), "utf8");
  return JSON.parse(contents) as { packageManager?: string };
}

/** Reads a committed non-secret operations document. */
async function readOperationsDocument(name: string): Promise<string> {
  return readFile(resolve(process.cwd(), "docs", "operations", name), "utf8");
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
    expect(preview).not.toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(preview).not.toContain("PREVIEW_RESTORE_TARGET_ID");
    expect(preview).not.toContain('echo "$');

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

  it("uploads only a safe Phase B security-scan summary", async () => {
    const production = await readWorkflow("production.yml");
    const scanStep = readWorkflowStep(
      production,
      "Re-run the Phase B release security boundary",
    );
    const summaryStep = readWorkflowStep(
      production,
      "Write safe release security summary",
    );
    const uploadStep = readWorkflowStep(
      production,
      "Upload safe release security summary",
    );

    expect(scanStep).toContain("id: release-security");
    expect(summaryStep).toContain(
      "SCAN_OUTCOME: ${{ steps.release-security.outcome }}",
    );
    expect(summaryStep).toContain(
      "dist/release-summary/security-scan.txt",
    );
    expect(uploadStep).toContain("uses: actions/upload-artifact@v4");
    expect(uploadStep).toContain("if: ${{ always() }}");
    expect(uploadStep).toContain(
      "path: dist/release-summary/security-scan.txt",
    );
    expect(uploadStep).not.toContain("dist/release-evidence");
  });
});

describe("preview OAuth acceptance policy", () => {
  it("keeps deployment credentials in GitHub and application secrets in the Worker runtime", async () => {
    const [preview, oauthSetup, secretPolicy, evidenceTemplate] = await Promise.all([
      readWorkflow("preview.yml"),
      readOperationsDocument("google-oauth-setup.md"),
      readOperationsDocument("secrets.md"),
      readOperationsDocument("calendar-setup-evidence.md"),
    ]);

    const tokenMapping =
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_PREVIEW }}";
    const accountMapping =
      "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID_PREVIEW }}";
    const authorizationStep = readWorkflowStep(
      preview,
      "Check preview deployment authorization",
    );
    const deployBuildStep = readWorkflowStep(
      preview,
      "Build deployable preview artifact",
    );
    const deploymentStep = readWorkflowStep(preview, "Deploy isolated preview Worker");

    expect(authorizationStep).toContain(tokenMapping);
    expect(authorizationStep).toContain(accountMapping);
    expect(authorizationStep).toContain('if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then');
    expect(authorizationStep).toContain('if [[ -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then');
    expect(deployBuildStep).toContain("run: pnpm build");
    expect(deploymentStep).toContain(tokenMapping);
    expect(deploymentStep).toContain(accountMapping);
    expect(deploymentStep).toContain("--config dist/vision/wrangler.json");
    expect(deploymentStep.includes("--env preview")).toBe(false);
    expect(deploymentStep.includes("--var ")).toBe(false);

    for (const runtimeSecret of [
      "DATABASE_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_ALLOWED_SUB",
      "GOOGLE_ALLOWED_EMAIL",
      "KEY_ENCRYPTION_KEY",
      "VISION_USER_TIME_ZONE",
    ]) {
      expect(preview).not.toContain(`${runtimeSecret}_PREVIEW`);
      expect(preview).not.toContain(`secrets.${runtimeSecret}`);
      expect(oauthSetup).toContain(runtimeSecret);
    }
    expect(oauthSetup).toContain("CLOUDFLARE_API_TOKEN_PREVIEW");
    expect(oauthSetup).toContain("CLOUDFLARE_ACCOUNT_ID_PREVIEW");
    expect(oauthSetup).toContain("Cloudflare Worker runtime");
    expect(secretPolicy).toContain("separately managed, non-live preview values");
    expect(secretPolicy).toContain(
      "fails before deployment when either preview deployment entry is unavailable",
    );
    expect(preview).not.toContain('echo "$');
    expect(oauthSetup).toContain("/api/auth/google/callback");
    expect(evidenceTemplate).toContain("Approval required before external acceptance");
    expect(evidenceTemplate).toContain("calendar ID suffix");
  });
});

describe("preview AI acceptance policy", () => {
  it("allows only an explicitly approved preview-only provider key", async () => {
    const secretPolicy = await readOperationsDocument("secrets.md");
    const openAiRow = secretPolicy
      .split(/\r?\n/u)
      .find((line) => line.startsWith("| `OPENAI_API_KEY` |"));

    expect(openAiRow).toBe(
      "| `OPENAI_API_KEY` | AI integration owner | Server-side approved environments only after explicit AI acceptance approval | Provider key rotation, budget/security incident, or owner change | Yes, with a preview-only value after explicit approval |",
    );
    expect(secretPolicy).toContain(
      "Application secrets remain in the Cloudflare Worker runtime",
    );
  });
});

describe("preview live diagnostics policy", () => {
  it("can tail one scheduled event without exposing raw provider output", async () => {
    const preview = await readWorkflow("preview.yml");
    const tailStep = readWorkflowStep(
      preview,
      "Print only allowlisted scheduled evidence",
    );

    expect(preview).toContain("safe_tail:");
    expect(preview).toContain("configure_ai_budget:");
    expect(preview).toContain(
      "if: ${{ inputs.safe_tail == false && inputs.configure_ai_budget == false }}",
    );
    expect(preview).toContain(
      "if: ${{ inputs.safe_tail == true && inputs.configure_ai_budget == false }}",
    );
    expect(preview).toContain(
      "if: ${{ inputs.configure_ai_budget == true && inputs.safe_tail == false }}",
    );
    expect(preview.match(/^  deploy:/gmu)).toHaveLength(1);
    expect(preview.match(/^  tail:/gmu)).toHaveLength(1);
    expect(preview.match(/^  configure_gateway:/gmu)).toHaveLength(1);
    expect(tailStep).toContain(
      "pnpm exec wrangler tail vision-preview --format json 2>/dev/null |\n" +
        "            pnpm exec tsx scripts/print-safe-tail.ts",
    );
    expect(tailStep).toContain("--format json 2>/dev/null");
    expect(tailStep).toContain(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_PREVIEW }}",
    );
    expect(tailStep).toContain(
      "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID_PREVIEW }}",
    );
    expect(tailStep).not.toContain("--log");
    expect(tailStep).not.toContain("actions/upload-artifact");
  });
});
