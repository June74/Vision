/**
 * Permanent Task 8 contract for removing acceptance-only runtime reachability
 * while retaining recovery, maintenance, usage, schedule, and backup safety.
 */
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const STRICT_CLEANUP =
  process.env.PREVIEW_ACCEPTANCE_CLEANUP_ASSERT === "true";

const TEMPORARY_ACTIVE_SURFACE_PATTERNS = [
  /vision\.(?:phase-b-foundation-probe|ai-usage|preview-fault)\/v1/u,
  /temporary-preview-(?:role-probe|restore|fault)/u,
  /PREVIEW_(?:ACCEPTANCE|RESTORE)_[A-Z0-9_]+/u,
  /\* \* \* \* \*/u,
  /parseTemporaryPreviewAcceptance(?:Selector|AiGatewayAttestation)/u,
  /TEMPORARY_PREVIEW_(?:ACCEPTANCE_SELECTORS|FAULT_SCENARIOS)/u,
  /\b(?:deploy_foundation|deploy_ai|deploy_fault)\b/u,
  /--(?:foundation-probe|ai-usage|preview-fault|role-probe|restore)-only\b/u,
  /(?:validatePreviewAcceptanceDeployConfig|preparePreviewAcceptanceDeployConfig|validatePreviewAcceptanceWorkflowInputs)/u,
  /prepare-preview-acceptance-deploy-config/u,
  /\b(?:foundationProbe|aiUsageEvidence|temporaryFaultR2Upload)\b/u,
  /\b(?:candidate selector|generated selector|generated candidate|generated preview candidate|AI[- ]attestation|six[- ]fault)\b/u,
  /eight\s+temporary selectors/u,
  /temporary Gateway attestation/u,
  /temporary restore database\s+binding/u,
] as const;

const TEMPORARY_PATHS = [
  "src/data/backup/r2-restore-attempt-store.ts",
  "src/data/backup/temporary-preview-clear-adapter.ts",
  "src/data/backup/temporary-preview-role-probe-adapter.ts",
  "src/data/phase-b-ai-usage-source.ts",
  "src/data/phase-b-foundation-probe.ts",
  "src/domain/operations/temporary-preview-fault.ts",
  "src/jobs/phase-b-ai-usage-evidence.ts",
  "src/jobs/phase-b-foundation-probe.ts",
  "src/jobs/temporary-preview-fault.ts",
  "src/jobs/temporary-preview-restore.ts",
  "src/jobs/temporary-preview-role-probe.ts",
  "scripts/prepare-preview-acceptance-deploy-config.ts",
  "scripts/validate-preview-acceptance-window.ts",
  "scripts/validate-preview-observer-state.ts",
  "scripts/validate-preview-rollback-lifecycle.ts",
  "tests/integration/backup/r2-restore-attempt-store.test.ts",
  "tests/integration/backup/temporary-preview-clear-adapter.test.ts",
  "tests/integration/backup/temporary-preview-role-probe-adapter.test.ts",
  "tests/integration/data/phase-b-ai-usage-source.test.ts",
  "tests/integration/data/phase-b-foundation-probe.test.ts",
  "tests/integration/jobs/phase-b-ai-usage-evidence.test.ts",
  "tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts",
  "tests/integration/jobs/phase-b-foundation-probe.test.ts",
  "tests/integration/jobs/temporary-preview-fault.test.ts",
  "tests/integration/jobs/temporary-preview-restore.test.ts",
  "tests/integration/jobs/temporary-preview-role-probe.test.ts",
  "tests/unit/domain/temporary-preview-fault.test.ts",
  "tests/unit/scripts/preview-acceptance-window.test.ts",
  "tests/unit/scripts/preview-observer-state.test.ts",
  "tests/unit/scripts/preview-rollback-lifecycle.test.ts",
  "docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md",
  "docs/reference/simple/scripts/validate-preview-acceptance-window.md",
  "docs/reference/simple/scripts/validate-preview-observer-state.md",
  "docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md",
  "docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md",
  "docs/reference/technical/scripts/validate-preview-acceptance-window.md",
  "docs/reference/technical/scripts/validate-preview-observer-state.md",
  "docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md",
  "docs/reference/simple/src/data/backup/r2-restore-attempt-store.md",
  "docs/reference/simple/src/data/backup/temporary-preview-clear-adapter.md",
  "docs/reference/simple/src/data/backup/temporary-preview-role-probe-adapter.md",
  "docs/reference/simple/src/data/phase-b-ai-usage-source.md",
  "docs/reference/simple/src/data/phase-b-foundation-probe.md",
  "docs/reference/simple/src/domain/operations/temporary-preview-fault.md",
  "docs/reference/simple/src/jobs/phase-b-ai-usage-evidence.md",
  "docs/reference/simple/src/jobs/phase-b-foundation-probe.md",
  "docs/reference/simple/src/jobs/temporary-preview-fault.md",
  "docs/reference/simple/src/jobs/temporary-preview-restore.md",
  "docs/reference/simple/src/jobs/temporary-preview-role-probe.md",
  "docs/reference/technical/src/data/backup/r2-restore-attempt-store.md",
  "docs/reference/technical/src/data/backup/temporary-preview-clear-adapter.md",
  "docs/reference/technical/src/data/backup/temporary-preview-role-probe-adapter.md",
  "docs/reference/technical/src/data/phase-b-ai-usage-source.md",
  "docs/reference/technical/src/data/phase-b-foundation-probe.md",
  "docs/reference/technical/src/domain/operations/temporary-preview-fault.md",
  "docs/reference/technical/src/jobs/phase-b-ai-usage-evidence.md",
  "docs/reference/technical/src/jobs/phase-b-foundation-probe.md",
  "docs/reference/technical/src/jobs/temporary-preview-fault.md",
  "docs/reference/technical/src/jobs/temporary-preview-restore.md",
  "docs/reference/technical/src/jobs/temporary-preview-role-probe.md",
] as const;

const REQUIRED_ROLLBACK_LIFECYCLE_PATHS = [
  "scripts/validate-preview-rollback-lifecycle.ts",
  "tests/unit/scripts/preview-rollback-lifecycle.test.ts",
  "docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md",
  "docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md",
] as const;

const ACTIVE_SURFACE_ROOTS = [
  "src",
  "tests",
  "scripts",
  ".github",
  "docs/reference",
] as const;

const EXPECTED_SHARED_RESIDUE_PATHS = [
  ".github/workflows/preview.yml",
  "docs/reference/simple/scripts/print-safe-tail.md",
  "docs/reference/simple/scripts/safe-tail-classifier.md",
  "docs/reference/simple/scripts/validate-preview-deploy-config.md",
  "docs/reference/simple/src/jobs/scheduled.md",
  "docs/reference/simple/src/server/api/ai-category-proposal-routes.md",
  "docs/reference/simple/src/server/api/diagnostic-routes.md",
  "docs/reference/simple/src/server/client-binding-boundary.md",
  "docs/reference/simple/src/server/env.md",
  "docs/reference/technical/scripts/print-safe-tail.md",
  "docs/reference/technical/scripts/safe-tail-classifier.md",
  "docs/reference/technical/scripts/validate-preview-deploy-config.md",
  "docs/reference/technical/src/jobs/scheduled.md",
  "docs/reference/technical/src/server/api/ai-category-proposal-routes.md",
  "docs/reference/technical/src/server/api/diagnostic-routes.md",
  "docs/reference/technical/src/server/client-binding-boundary.md",
  "docs/reference/technical/src/server/env.md",
  "scripts/print-safe-tail.ts",
  "scripts/safe-tail-classifier.ts",
  "scripts/validate-preview-deploy-config.ts",
  "src/jobs/scheduled.ts",
  "src/server/api/ai-category-proposal-routes.ts",
  "src/server/api/diagnostic-routes.ts",
  "src/server/client-binding-boundary.ts",
  "src/server/env.ts",
  "tests/e2e/foundation-diagnostics.spec.ts",
  "tests/integration/jobs/daily-backup.test.ts",
  "tests/security/secret-bundle.test.ts",
  "tests/unit/ci/workflows.test.ts",
  "tests/unit/scripts/print-safe-tail.test.ts",
  "tests/unit/scripts/production-deploy-config.test.ts",
  "tests/unit/scripts/safe-tail-classifier.test.ts",
  "tests/unit/server/env.test.ts",
  "tests/unit/server/wrangler-routing.test.ts",
  "tests/worker/diagnostics.test.ts",
] as const;

const APPROVED_ACTIVE_SCAN_EXCLUSIONS = new Set<string>([
  ...TEMPORARY_PATHS,
  "tests/security/temporary-surface-cleanup.test.ts",
  // Offline restore remains operator-only after Worker acceptance cleanup.
  "scripts/restore-backup.ts",
  "tests/integration/backup/restore-command.test.ts",
]);

const PERMANENT_PATHS = [
  "src/data/backup/import-backup.ts",
  "src/data/backup/neon-adapter.ts",
  "src/data/usage-warning-source.ts",
  "src/domain/operations/health.ts",
  "src/domain/operations/usage-warnings.ts",
  "src/jobs/calendar-maintenance-evidence.ts",
  "src/jobs/create-daily-backup.ts",
  "src/server/auth/oauth-routes.ts",
  "scripts/restore-backup.ts",
  "scripts/scan-release.ts",
  "scripts/capture-release-evidence.ts",
  "scripts/safe-tail-classifier.ts",
  "scripts/print-safe-tail.ts",
  "tests/integration/backup/restore-command.test.ts",
  "tests/integration/backup/round-trip.test.ts",
  "tests/integration/backup/schema-contract.test.ts",
  "tests/security/protected-sentinel.test.ts",
  "tests/security/release-evidence-capture.test.ts",
  "tests/security/secret-bundle.test.ts",
  "tests/unit/domain/health.test.ts",
  "tests/unit/scripts/safe-tail-classifier.test.ts",
  "tests/unit/scripts/print-safe-tail.test.ts",
  "docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md",
  "docs/operations/backup-and-restore.md",
  "docs/operations/credential-change-log.md",
  "docs/operations/phase-b-implementation-setbacks.md",
  "docs/operations/phase-b-evidence.md",
  "docs/operations/setbacks/INDEX.md",
  "docs/operations/setbacks/incidents/2026-07-29T170120Z-task6-observer-family-proof-gap.md",
] as const;

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(resolve(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath: string): Promise<string> {
  return readFile(resolve(process.cwd(), relativePath), "utf8");
}

function containsTemporaryActiveSurface(source: string): boolean {
  return TEMPORARY_ACTIVE_SURFACE_PATTERNS.some((pattern) =>
    pattern.test(source),
  );
}

async function listFiles(relativePath: string): Promise<string[]> {
  const entries = await readdir(resolve(process.cwd(), relativePath), {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const child = `${relativePath}/${entry.name}`.replaceAll("\\", "/");
      if (entry.isDirectory()) return listFiles(child);
      return entry.isFile() ? [child] : [];
    }),
  );
  return nested.flat();
}

async function listActiveSurfaceResidue(): Promise<string[]> {
  const activePaths = [
    ...(await Promise.all(ACTIVE_SURFACE_ROOTS.map(listFiles))).flat(),
    "wrangler.jsonc",
  ]
    .filter((path) => !APPROVED_ACTIVE_SCAN_EXCLUSIONS.has(path))
    .sort();
  if (await exists("dist/vision/wrangler.json")) {
    activePaths.push("dist/vision/wrangler.json");
  }
  return (
    await Promise.all(
      activePaths.map(async (path) => ({
        path,
        source: await read(path),
      })),
    )
  )
    .filter(({ source }) => containsTemporaryActiveSurface(source))
    .map(({ path }) => path);
}

describe("post-acceptance temporary surface cleanup", () => {
  it("detects representative shared route, workflow, validator, observer, reference, and test residue", () => {
    const representatives = [
      'parseTemporaryPreviewAcceptanceSelector(context.env)',
      'parseTemporaryPreviewAcceptanceAiGatewayAttestation(context.env)',
      'operation: "deploy_foundation"',
      'operation: "deploy_ai"',
      'operation: "deploy_fault"',
      'evidence_flag="--foundation-probe-only"',
      'evidence_flag="--ai-usage-only"',
      'evidence_flag="--preview-fault-only"',
      "validatePreviewAcceptanceDeployConfig(candidate, selector)",
      "preparePreviewAcceptanceDeployConfig(input)",
      'from "../../domain/operations/temporary-preview-fault"',
      "Status validates the complete candidate selector and AI attestation.",
      "A generated preview candidate routes one dedicated evidence family.",
      'PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe"',
      "The eight\ntemporary selectors are preview-only.",
      "temporary Gateway attestation",
      "temporary restore database\nbinding",
    ];

    expect(
      representatives.filter(containsTemporaryActiveSurface),
    ).toEqual(representatives);
  });

  it("does not classify permanent health and authentication vocabulary as Task 8 residue", async () => {
    const [health, healthTest, oauth] = await Promise.all([
      read("src/domain/operations/health.ts"),
      read("tests/unit/domain/health.test.ts"),
      read("src/server/auth/oauth-routes.ts"),
    ]);

    expect(health).toContain('"QUEUE_DELAYED"');
    expect(health).toContain('"CHANNEL_EXPIRED"');
    expect(health).toContain('"DATABASE_UNAVAILABLE"');
    expect(healthTest).toContain('"QUEUE_DELAYED"');
    expect(oauth).toContain('"database_unavailable"');
    expect(
      [health, healthTest, oauth].filter(containsTemporaryActiveSurface),
    ).toEqual([]);
  });

  it("classifies both simple and technical environment references as generated temporary residue", async () => {
    const [simple, technical] = await Promise.all([
      read("docs/reference/simple/src/server/env.md"),
      read("docs/reference/technical/src/server/env.md"),
    ]);

    expect(simple).toContain("The eight");
    expect(simple).toContain("temporary selectors are preview-only");
    expect(simple).toContain("temporary Gateway attestation");
    expect(simple).toContain("temporary restore database");
    expect(technical).toContain("PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED");
    expect(technical).toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(
      [simple, technical].filter(containsTemporaryActiveSurface),
    ).toEqual([simple, technical]);
  });

  it("accounts for shared residue or enforces its post-cleanup absence", async () => {
    await expect(listActiveSurfaceResidue()).resolves.toEqual(
      STRICT_CLEANUP ? [] : EXPECTED_SHARED_RESIDUE_PATHS,
    );
  });

  it("keeps all dedicated and shared inventories unique with symmetric references", () => {
    const referenceInventory = (
      paths: readonly string[],
      kind: "simple" | "technical",
    ) =>
      paths
        .filter((path) => path.startsWith(`docs/reference/${kind}/`))
        .map((path) => path.replace(`docs/reference/${kind}/`, ""));

    expect(TEMPORARY_PATHS).toEqual(
      expect.arrayContaining([...REQUIRED_ROLLBACK_LIFECYCLE_PATHS]),
    );
    expect(TEMPORARY_PATHS).toHaveLength(60);
    expect(new Set(TEMPORARY_PATHS)).toHaveLength(60);
    expect(EXPECTED_SHARED_RESIDUE_PATHS).toHaveLength(35);
    expect(new Set(EXPECTED_SHARED_RESIDUE_PATHS)).toHaveLength(35);
    expect(referenceInventory(TEMPORARY_PATHS, "simple")).toEqual(
      referenceInventory(TEMPORARY_PATHS, "technical"),
    );
    expect(
      referenceInventory(EXPECTED_SHARED_RESIDUE_PATHS, "simple"),
    ).toEqual(
      referenceInventory(EXPECTED_SHARED_RESIDUE_PATHS, "technical"),
    );
  });

  it("removes the exact temporary source, test, script, and reference inventory", async () => {
    const existing = (
      await Promise.all(
        TEMPORARY_PATHS.map(async (path) => ({
          path,
          present: await exists(path),
        })),
      )
    )
      .filter(({ present }) => present)
      .map(({ path }) => path);

    if (STRICT_CLEANUP) {
      expect(existing).toEqual([]);
    } else {
      expect(existing).toEqual(TEMPORARY_PATHS);
    }
  });

  it("retains permanent recovery, maintenance, usage-warning, and history surfaces", async () => {
    await expect(
      Promise.all(PERMANENT_PATHS.map((path) => exists(path))),
    ).resolves.toEqual(PERMANENT_PATHS.map(() => true));

    const [
      wrangler,
      backup,
      restore,
      maintenance,
      usage,
      previewWorkflow,
      releaseScanner,
      secretBundleTest,
      protectedSentinelTest,
      safeTailClassifierTest,
      printSafeTailTest,
      historicalPlan,
      setbackIndex,
      credentialHistory,
      releaseEvidence,
    ] = await Promise.all([
      read("wrangler.jsonc"),
      read("src/jobs/create-daily-backup.ts"),
      read("scripts/restore-backup.ts"),
      read("src/jobs/calendar-maintenance-evidence.ts"),
      read("src/domain/operations/usage-warnings.ts"),
      read(".github/workflows/preview.yml"),
      read("scripts/scan-release.ts"),
      read("tests/security/secret-bundle.test.ts"),
      read("tests/security/protected-sentinel.test.ts"),
      read("tests/unit/scripts/safe-tail-classifier.test.ts"),
      read("tests/unit/scripts/print-safe-tail.test.ts"),
      read(
        "docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md",
      ),
      read("docs/operations/setbacks/INDEX.md"),
      read("docs/operations/credential-change-log.md"),
      read("docs/operations/phase-b-evidence.md"),
    ]);
    const config = JSON.parse(wrangler) as {
      triggers?: { crons?: string[] };
      vars?: Record<string, string>;
      env?: Record<
        "preview" | "production",
        {
          triggers?: { crons?: string[] };
          vars?: Record<string, string>;
        }
      >;
    };

    expect(config.triggers?.crons).toEqual([
      "*/15 * * * *",
      "5 6 * * *",
    ]);
    expect(config.env?.preview.triggers?.crons).toEqual(
      config.triggers?.crons,
    );
    expect(config.env?.production.triggers?.crons).toEqual(
      config.triggers?.crons,
    );
    expect(config.vars?.BACKUP_KEY_VERSION).toBe("1");
    expect(config.env?.preview.vars?.BACKUP_KEY_VERSION).toBe("1");
    expect(config.env?.production.vars?.BACKUP_KEY_VERSION).toBe("1");
    expect(backup).toContain('BACKUP_OBJECT_PREFIX = "backups/v1/"');
    expect(backup).toContain("await dependencies.store.delete(objectKey)");
    expect(backup).not.toMatch(/delete(?:All|Prefix)/u);
    expect(backup).not.toContain("delete(BACKUP_OBJECT_PREFIX");
    expect(restore).toContain("importBackup");
    expect(maintenance).toContain("vision.calendar-maintenance/v1");
    expect(usage).toContain("calculateUsageWarnings");
    expect(previewWorkflow).toContain("vision-preview-observer");
    expect(previewWorkflow).toContain("vision-preview-mutation");
    expect(previewWorkflow).toContain("timeout-minutes: 18");
    expect(previewWorkflow).toContain("timeout 16m");
    expect(releaseScanner).toContain("scanRelease");
    expect(secretBundleTest).toContain("client secret-bundle boundary");
    expect(protectedSentinelTest).toContain("protected sentinel");
    expect(safeTailClassifierTest).toContain("safe tail");
    expect(printSafeTailTest).toContain('describe("print-safe-tail"');
    expect(historicalPlan).toContain("Task 8: Remove Temporary Acceptance Surfaces");
    expect(setbackIndex).toContain("# Setback index");
    expect(credentialHistory).toContain("# Credential and key change log");
    expect(releaseEvidence).toContain("# Phase B completion evidence");
  });
});
