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

/** Extracts one top-level workflow job without requiring a YAML runtime dependency. */
function readWorkflowJob(workflow: string, name: string): string {
  const marker = `  ${name}:`;
  const start = workflow.indexOf(marker);
  if (start === -1) {
    throw new Error(`Workflow job not found: ${name}`);
  }
  const remainder = workflow.slice(start + marker.length);
  const nextJobOffset = remainder.search(/\n {2}[A-Za-z_][A-Za-z0-9_]*:/u);
  return workflow.slice(
    start,
    nextJobOffset === -1
      ? undefined
      : start + marker.length + nextJobOffset,
  );
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

/** Extracts the literal options from one workflow_dispatch choice input. */
function readWorkflowChoiceOptions(
  workflow: string,
  inputName: string,
): string[] {
  const marker = `      ${inputName}:`;
  const start = workflow.indexOf(marker);
  if (start === -1) {
    throw new Error(`Workflow input not found: ${inputName}`);
  }
  const remainder = workflow.slice(start + marker.length);
  const nextInputOffset = remainder.search(/\n {6}[A-Za-z_][A-Za-z0-9_]*:/u);
  const block =
    nextInputOffset === -1 ? remainder : remainder.slice(0, nextInputOffset);
  const options = block.matchAll(/^ {10}- ([a-z0-9_]+)$/gmu);
  return [...options].map((match) => match[1]!);
}

/** Returns explicit step names in execution order for adjacency assertions. */
function readWorkflowStepNames(job: string): string[] {
  return [...job.matchAll(/^      - name: (.+)$/gmu)].map(
    (match) => match[1]!,
  );
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
    expect(preview).toContain(
      "permissions:\n  actions: read\n  contents: read",
    );
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
    const [preview, restoreDrill] = await Promise.all([
      readWorkflow("preview.yml"),
      readOperationsDocument("restore-drill.md"),
    ]);
    const tailStep = readWorkflowStep(
      preview,
      "Print only allowlisted acceptance evidence",
    );
    const tailJob = readWorkflowJob(preview, "tail");

    expect(preview).toContain("acceptance_operation:");
    expect(preview).toContain("configure_ai_budget:");
    expect(preview).toContain(
      "if: ${{ inputs.acceptance_operation != 'observe' && inputs.configure_ai_budget == false }}",
    );
    expect(preview).toContain(
      "if: ${{ inputs.acceptance_operation == 'observe' && inputs.configure_ai_budget == false }}",
    );
    expect(preview).toContain(
      "if: ${{ inputs.configure_ai_budget == true && inputs.acceptance_operation == 'none' && inputs.fault_scenario == 'none' }}",
    );
    expect(preview.match(/^  deploy:/gmu)).toHaveLength(1);
    expect(preview.match(/^  tail:/gmu)).toHaveLength(1);
    expect(preview.match(/^  configure_gateway:/gmu)).toHaveLength(1);
    expect(preview).toContain(
      "concurrency:\n" +
        "  group: ${{ inputs.acceptance_operation == 'observe' && inputs.configure_ai_budget == false && 'vision-preview-observer' || 'vision-preview-mutation' }}\n" +
        "  cancel-in-progress: true",
    );
    expect(preview).not.toContain("group: vision-preview\n");
    expect(tailJob).toContain("timeout-minutes: 18");
    expect(tailJob).toContain(
      "uses: actions/checkout@v5\n" +
        "        with:\n" +
        "          ref: ${{ github.sha }}",
    );
    expect(tailJob).not.toContain("wrangler deploy");
    expect(tailJob).not.toContain("gateway:configure:preview");
    expect(tailJob).not.toContain("actions/upload-artifact");
    expect(tailStep).toContain(
      "timeout 16m pnpm exec wrangler tail vision-preview --format json 2>/dev/null |\n" +
        '            pnpm exec tsx scripts/print-safe-tail.ts "$evidence_flag"',
    );
    expect(tailStep).not.toContain("--restore-only");
    expect(tailStep).not.toContain("--role-probe-only");
    expect(tailStep).toContain("--format json 2>/dev/null");
    expect(tailStep).toContain(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN_PREVIEW }}",
    );
    expect(tailStep).toContain(
      "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID_PREVIEW }}",
    );
    expect(tailStep).not.toContain("--log");
    expect(tailStep).not.toContain("actions/upload-artifact");
    expect(restoreDrill).toContain(
      "Confirm the allowlisted listener step is actively running before deploying the restore candidate.",
    );
    expect(restoreDrill).toContain(
      "Safe-tail observers use `vision-preview-observer`; deployment, verification, and Gateway configuration use `vision-preview-mutation`.",
    );
  });
});

describe("preview acceptance candidate workflow", () => {
  it("binds every pre-verification checkout to the dispatch commit and proves the observer checkout before credentials", async () => {
    const preview = await readWorkflow("preview.yml");
    const observer = readWorkflowJob(preview, "tail");
    const verify = readWorkflowJob(preview, "verify");
    const observerCheckout = readWorkflowStep(
      preview,
      "Verify observer checkout matches dispatch commit",
    );
    const tailStep = readWorkflowStep(
      preview,
      "Print only allowlisted acceptance evidence",
    );

    expect(preview).not.toContain("      ref:\n");
    expect(preview).not.toContain("inputs.ref");
    expect(verify).toContain("ref: ${{ github.sha }}");
    expect(verify.indexOf("actions/checkout@v5")).toBeLessThan(
      verify.indexOf("name: Resolve verified commit"),
    );
    expect(verify).toContain('echo "sha=$(git rev-parse HEAD)"');
    expect(observer).toContain("ref: ${{ github.sha }}");
    expect(observerCheckout).toContain("EXPECTED_SHA: ${{ github.sha }}");
    expect(observerCheckout).toContain('actual_sha="$(git rev-parse HEAD)"');
    expect(observerCheckout).toContain(
      '[[ "$actual_sha" == "$EXPECTED_SHA" ]]',
    );
    expect(observerCheckout).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(observerCheckout).not.toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(observer.indexOf("Verify observer checkout matches dispatch commit")).toBeLessThan(
      observer.indexOf("Install locked dependencies"),
    );
    expect(observer.indexOf("Verify observer checkout matches dispatch commit")).toBeLessThan(
      observer.indexOf("Print only allowlisted acceptance evidence"),
    );
    expect(tailStep).toContain("CLOUDFLARE_API_TOKEN");
  });

  it("admits only the exact operation and fault choice vocabularies", async () => {
    const preview = await readWorkflow("preview.yml");

    expect(readWorkflowChoiceOptions(preview, "acceptance_operation")).toEqual([
      "none",
      "observe",
      "deploy_foundation",
      "deploy_ai",
      "deploy_fault",
      "rollback",
    ]);
    expect(readWorkflowChoiceOptions(preview, "fault_scenario")).toEqual([
      "none",
      "queue_delayed",
      "job_failed",
      "channel_expired",
      "database_unavailable",
      "r2_upload_failed",
      "ai_stopped",
    ]);
    expect(preview).toContain(
      "pnpm exec tsx scripts/prepare-preview-acceptance-deploy-config.ts --verify-workflow-inputs",
    );
    expect(preview).toContain(
      "--operation \"${{ inputs.acceptance_operation }}\"",
    );
    expect(preview).toContain(
      "--fault-scenario \"${{ inputs.fault_scenario }}\"",
    );
  });

  it("keeps observer and mutation runs separate and bounded", async () => {
    const preview = await readWorkflow("preview.yml");
    const observer = readWorkflowJob(preview, "tail");
    const tailStep = readWorkflowStep(
      preview,
      "Print only allowlisted acceptance evidence",
    );

    expect(preview).toContain(
      "group: ${{ inputs.acceptance_operation == 'observe' && inputs.configure_ai_budget == false && 'vision-preview-observer' || 'vision-preview-mutation' }}",
    );
    expect(observer).toContain("timeout-minutes: 18");
    expect(observer).toContain("ref: ${{ github.sha }}");
    expect(observer).not.toContain("wrangler deploy");
    expect(observer).not.toContain("gateway:configure:preview");
    expect(tailStep).toContain("timeout 16m");
    expect(tailStep).toContain("--format json 2>/dev/null");
    expect(tailStep).not.toContain("actions/upload-artifact");
  });

  it("requires live observer proof before deploying an isolated generated candidate", async () => {
    const preview = await readWorkflow("preview.yml");
    const candidate = readWorkflowJob(preview, "deploy_acceptance_candidate");
    const proofStep = readWorkflowStep(
      preview,
      "Verify active privacy-safe observer",
    );
    const buildStep = readWorkflowStep(
      preview,
      "Build generated acceptance candidate",
    );
    const deployStep = readWorkflowStep(
      preview,
      "Deploy generated acceptance candidate",
    );

    expect(candidate).toContain(
      "ref: ${{ needs.verify.outputs.verified_sha }}",
    );
    expect(proofStep).toContain("OBSERVER_RUN_ID");
    expect(proofStep).toContain("actions/runs/$OBSERVER_RUN_ID");
    expect(proofStep).toContain("head_sha");
    expect(proofStep).toContain("in_progress");
    expect(proofStep).toContain(
      '.path == ".github/workflows/preview.yml" or',
    );
    expect(proofStep).toContain(
      '(.path | startswith(".github/workflows/preview.yml@refs/"))',
    );
    expect(proofStep).not.toContain(
      'startswith(".github/workflows/preview.yml")',
    );
    expect(proofStep).toContain(
      "VERIFIED_SHA: ${{ needs.verify.outputs.verified_sha }}",
    );
    expect(proofStep).not.toContain("VERIFIED_SHA: ${{ github.sha }}");
    expect(proofStep).toContain(
      'deploy_foundation) expected_observer_evidence="foundation_probe"',
    );
    expect(proofStep).toContain(
      'deploy_ai) expected_observer_evidence="ai_usage"',
    );
    expect(proofStep).toContain(
      'deploy_fault) expected_observer_evidence="preview_fault"',
    );
    expect(proofStep).toContain("--arg expected_name");
    expect(proofStep).toContain(".name == $expected_name");
    expect(readWorkflowJob(preview, "tail")).toContain(
      "name: Capture ${{ inputs.observer_evidence }} safe scheduled outcome",
    );
    expect(buildStep).toContain(
      "scripts/prepare-preview-acceptance-deploy-config.ts",
    );
    expect(buildStep).toContain(
      "--input dist/vision/wrangler.json",
    );
    expect(buildStep).toContain(
      "--output dist/vision/wrangler.acceptance.json",
    );
    expect(deployStep).toContain(
      "--config dist/vision/wrangler.acceptance.json",
    );
    expect(deployStep).not.toContain("--var ");
    expect(candidate).not.toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(candidate).not.toContain("PREVIEW_RESTORE_TARGET_ID");
  });

  it("rechecks the exact matching observer immediately before candidate deployment", async () => {
    const preview = await readWorkflow("preview.yml");
    const candidate = readWorkflowJob(preview, "deploy_acceptance_candidate");
    const finalProof = readWorkflowStep(
      preview,
      "Reverify active matching observer immediately before deploy",
    );
    const names = readWorkflowStepNames(candidate);
    const finalProofIndex = names.indexOf(
      "Reverify active matching observer immediately before deploy",
    );
    const deployIndex = names.indexOf("Deploy generated acceptance candidate");

    expect(finalProofIndex).toBeGreaterThan(-1);
    expect(deployIndex).toBe(finalProofIndex + 1);
    expect(finalProof).toContain("actions/runs/$OBSERVER_RUN_ID");
    expect(finalProof).toContain(
      "VERIFIED_SHA: ${{ needs.verify.outputs.verified_sha }}",
    );
    expect(finalProof).toContain(".head_sha == $sha");
    expect(finalProof).toContain(".status == \"in_progress\"");
    expect(finalProof).toContain(".name == $expected_name");
    expect(finalProof).toContain(
      '.path == ".github/workflows/preview.yml" or',
    );
    expect(finalProof).toContain(
      '(.path | startswith(".github/workflows/preview.yml@refs/"))',
    );
  });

  it("runs the read-only Gateway verifier only for AI stop or dedicated AI evidence", async () => {
    const preview = await readWorkflow("preview.yml");
    const candidate = readWorkflowJob(preview, "deploy_acceptance_candidate");
    const verifier = readWorkflowStep(
      preview,
      "Verify the existing AI Gateway limit",
    );
    const buildStep = readWorkflowStep(
      preview,
      "Build generated acceptance candidate",
    );

    expect(verifier).toContain(
      "inputs.acceptance_operation == 'deploy_ai' || (inputs.acceptance_operation == 'deploy_fault' && inputs.fault_scenario == 'ai_stopped')",
    );
    expect(verifier).toContain("pnpm gateway:verify:preview");
    expect(verifier).not.toContain("gateway:configure:preview");
    expect(buildStep).toContain(
      "AI_GATEWAY_LIMIT_ATTESTED: ${{ inputs.acceptance_operation == 'deploy_ai' && steps.gateway-attestation.outputs.attested || '' }}",
    );
    expect(buildStep).toContain(
      "--ai-gateway-limit-attested \"$AI_GATEWAY_LIMIT_ATTESTED\"",
    );
    expect(candidate).not.toContain(
      "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: ${{",
    );
  });

  it("keeps rollback separately operator-dispatched over the verified normal artifact", async () => {
    const preview = await readWorkflow("preview.yml");
    const rollback = readWorkflowJob(preview, "rollback");
    const deployStep = readWorkflowStep(
      preview,
      "Deploy immutable normal preview Worker",
    );
    const verificationStep = readWorkflowStep(
      preview,
      "Verify normal runtime and temporary-surface absence",
    );
    const candidate = readWorkflowJob(preview, "deploy_acceptance_candidate");
    const candidatePreflight = readWorkflowStep(
      preview,
      "Verify live preview is normal before candidate deployment",
    );
    const candidateNames = readWorkflowStepNames(candidate);

    expect(rollback).toContain(
      "if: ${{ inputs.acceptance_operation == 'rollback' && inputs.configure_ai_budget == false }}",
    );
    expect(rollback).toContain(
      "ref: ${{ needs.verify.outputs.verified_sha }}",
    );
    expect(rollback).toContain("pnpm deploy:check:preview");
    expect(deployStep).toContain("--config dist/vision/wrangler.json");
    expect(deployStep).not.toContain("wrangler.acceptance.json");
    expect(deployStep).not.toContain("--var ");
    expect(rollback).not.toContain("if: ${{ always() }}");
    expect(verificationStep).toContain("/api/health");
    expect(verificationStep).toContain("schedules");
    expect(verificationStep).toContain(
      "scripts/validate-preview-deploy-config.ts",
    );
    expect(verificationStep).toContain(
      "--verify-provider-state",
    );
    expect(verificationStep).not.toContain("// []");
    expect(candidatePreflight).toContain("/api/health");
    expect(candidatePreflight).toContain("schedules");
    expect(candidatePreflight).toContain("settings");
    expect(candidatePreflight).toContain(
      "scripts/validate-preview-deploy-config.ts",
    );
    expect(candidatePreflight).toContain(
      "--verify-provider-state",
    );
    expect(candidatePreflight).not.toContain("// []");
    expect(
      candidateNames.indexOf(
        "Verify live preview is normal before candidate deployment",
      ),
    ).toBeLessThan(candidateNames.indexOf("Build normal preview artifact"));
    expect(preview).toContain(
      "Provider cleanup is forbidden until this rollback verification succeeds.",
    );
  });
});
