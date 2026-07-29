/**
 * Permanent Task 8 contract for removing acceptance-only runtime reachability
 * while retaining recovery, maintenance, usage, schedule, and backup safety.
 */
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const STRICT_CLEANUP =
  process.env.PREVIEW_ACCEPTANCE_CLEANUP_ASSERT === "true";

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
  "docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md",
  "docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md",
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

const PERMANENT_PATHS = [
  "src/data/backup/import-backup.ts",
  "src/data/backup/neon-adapter.ts",
  "src/data/usage-warning-source.ts",
  "src/domain/operations/usage-warnings.ts",
  "src/jobs/calendar-maintenance-evidence.ts",
  "src/jobs/create-daily-backup.ts",
  "scripts/restore-backup.ts",
  "scripts/safe-tail-classifier.ts",
  "scripts/print-safe-tail.ts",
  "tests/integration/backup/restore-command.test.ts",
  "tests/integration/backup/round-trip.test.ts",
  "tests/integration/backup/schema-contract.test.ts",
  "docs/operations/backup-and-restore.md",
  "docs/operations/credential-change-log.md",
  "docs/operations/phase-b-evidence.md",
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

describe("post-acceptance temporary surface cleanup", () => {
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

  it.runIf(STRICT_CLEANUP)(
    "removes active bindings, evidence modes, and one-minute routing",
    async () => {
      const activePaths = [
        "src/server/env.ts",
        "src/server/client-binding-boundary.ts",
        "src/jobs/scheduled.ts",
        "scripts/safe-tail-classifier.ts",
        "scripts/print-safe-tail.ts",
        ".github/workflows/preview.yml",
        "wrangler.jsonc",
        "scripts/validate-preview-deploy-config.ts",
        "docs/reference/simple/scripts/safe-tail-classifier.md",
        "docs/reference/technical/scripts/safe-tail-classifier.md",
        "docs/reference/technical/scripts/print-safe-tail.md",
      ];
      if (await exists("dist/vision/wrangler.json")) {
        activePaths.push("dist/vision/wrangler.json");
      }
      const residue = (
        await Promise.all(
          activePaths.map(async (path) => ({
            path,
            source: await read(path),
          })),
        )
      )
        .filter(({ source }) =>
          /vision\.(?:phase-b-foundation-probe|ai-usage|preview-fault)\/v1|temporary-preview-(?:role-probe|restore)|PREVIEW_ACCEPTANCE_|PREVIEW_RESTORE_|\* \* \* \* \*/u.test(
            source,
          ),
        )
        .map(({ path }) => path);

      expect(residue).toEqual([]);
    },
  );

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
    ] = await Promise.all([
      read("wrangler.jsonc"),
      read("src/jobs/create-daily-backup.ts"),
      read("scripts/restore-backup.ts"),
      read("src/jobs/calendar-maintenance-evidence.ts"),
      read("src/domain/operations/usage-warnings.ts"),
      read(".github/workflows/preview.yml"),
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
  });
});
