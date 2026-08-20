/** Owns the reviewed Phase B acceptance cleanup and retention inventory. */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type PhaseBAcceptancePathDisposition =
  | "delete_dedicated"
  | "unwind_shared"
  | "retain_permanent"
  | "retain_historical";

export interface PhaseBAcceptancePathClassification {
  readonly path: string;
  readonly disposition: PhaseBAcceptancePathDisposition;
}

const LITERAL_PHASE_B_ACCEPTANCE_PATH_MAP = [
  ["src/data/backup/r2-restore-attempt-store.ts", "delete_dedicated"],
  ["src/data/backup/temporary-preview-clear-adapter.ts", "delete_dedicated"],
  ["src/data/backup/temporary-preview-role-probe-adapter.ts", "delete_dedicated"],
  ["src/data/phase-b-ai-usage-source.ts", "delete_dedicated"],
  ["src/data/phase-b-foundation-probe.ts", "delete_dedicated"],
  ["src/domain/operations/temporary-preview-fault.ts", "delete_dedicated"],
  ["src/jobs/phase-b-ai-usage-evidence.ts", "delete_dedicated"],
  ["src/jobs/phase-b-foundation-probe.ts", "delete_dedicated"],
  ["src/jobs/temporary-preview-fault.ts", "delete_dedicated"],
  ["src/jobs/temporary-preview-restore.ts", "delete_dedicated"],
  ["src/jobs/temporary-preview-role-probe.ts", "delete_dedicated"],
  ["scripts/prepare-preview-acceptance-deploy-config.ts", "delete_dedicated"],
  ["scripts/validate-preview-acceptance-window.ts", "delete_dedicated"],
  ["scripts/validate-preview-observer-state.ts", "delete_dedicated"],
  ["scripts/validate-preview-rollback-lifecycle.ts", "delete_dedicated"],
  ["tests/integration/backup/r2-restore-attempt-store.test.ts", "delete_dedicated"],
  ["tests/integration/backup/temporary-preview-clear-adapter.test.ts", "delete_dedicated"],
  ["tests/integration/backup/temporary-preview-role-probe-adapter.test.ts", "delete_dedicated"],
  ["tests/integration/data/phase-b-ai-usage-source.test.ts", "delete_dedicated"],
  ["tests/integration/data/phase-b-foundation-probe.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/phase-b-ai-usage-evidence.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/phase-b-foundation-probe.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/temporary-preview-fault.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/temporary-preview-restore.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/temporary-preview-role-probe.test.ts", "delete_dedicated"],
  ["tests/unit/domain/temporary-preview-fault.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-acceptance-window.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-observer-state.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-rollback-lifecycle.test.ts", "delete_dedicated"],
  ["docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/validate-preview-acceptance-window.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/validate-preview-observer-state.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/validate-preview-acceptance-window.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/validate-preview-observer-state.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/backup/r2-restore-attempt-store.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/backup/temporary-preview-clear-adapter.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/backup/temporary-preview-role-probe-adapter.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/phase-b-ai-usage-source.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/phase-b-foundation-probe.md", "delete_dedicated"],
  ["docs/reference/simple/src/domain/operations/temporary-preview-fault.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/phase-b-ai-usage-evidence.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/phase-b-foundation-probe.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/temporary-preview-fault.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/temporary-preview-restore.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/temporary-preview-role-probe.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/backup/r2-restore-attempt-store.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/backup/temporary-preview-clear-adapter.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/backup/temporary-preview-role-probe-adapter.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/phase-b-ai-usage-source.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/phase-b-foundation-probe.md", "delete_dedicated"],
  ["docs/reference/technical/src/domain/operations/temporary-preview-fault.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/phase-b-ai-usage-evidence.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/phase-b-foundation-probe.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/temporary-preview-fault.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/temporary-preview-restore.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/temporary-preview-role-probe.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/resolve-preview-observer-run.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/run-preview-acceptance-controller.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/validate-preview-ai-browser-request.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/validate-preview-sync-acceptance.md", "delete_dedicated"],
  ["docs/reference/simple/src/data/backup/r2-backup-object-reader.md", "delete_dedicated"],
  ["docs/reference/simple/src/jobs/temporary-preview-restore-production.md", "delete_dedicated"],
  ["docs/reference/simple/src/server/webhooks/temporary-preview-sync-suppression.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/resolve-preview-observer-run.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/run-preview-acceptance-controller.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/validate-preview-ai-browser-request.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/validate-preview-sync-acceptance.md", "delete_dedicated"],
  ["docs/reference/technical/src/data/backup/r2-backup-object-reader.md", "delete_dedicated"],
  ["docs/reference/technical/src/jobs/temporary-preview-restore-production.md", "delete_dedicated"],
  ["docs/reference/technical/src/server/webhooks/temporary-preview-sync-suppression.md", "delete_dedicated"],
  ["scripts/resolve-preview-observer-run.ts", "delete_dedicated"],
  ["scripts/run-preview-acceptance-controller.ts", "delete_dedicated"],
  ["scripts/validate-preview-ai-browser-request.ts", "delete_dedicated"],
  ["scripts/validate-preview-sync-acceptance.ts", "delete_dedicated"],
  ["src/data/backup/r2-backup-object-reader.ts", "delete_dedicated"],
  ["src/jobs/temporary-preview-restore-production.ts", "delete_dedicated"],
  ["src/server/webhooks/temporary-preview-sync-suppression.ts", "delete_dedicated"],
  ["tests/integration/backup/r2-backup-object-reader.test.ts", "delete_dedicated"],
  ["tests/integration/jobs/temporary-preview-acceptance-routing.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-acceptance-controller.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-ai-browser-request.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-observer-run-resolution.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-sync-acceptance.test.ts", "delete_dedicated"],
  ["tests/unit/server/temporary-preview-sync-suppression.test.ts", "delete_dedicated"],
  ["tests/unit/jobs/temporary-preview-restore-production.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-acceptance-context.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-restore-readmission.test.ts", "delete_dedicated"],
  ["tests/unit/scripts/preview-tail-supervisor.test.ts", "delete_dedicated"],
  ["scripts/run-preview-restore-readmission.ts", "delete_dedicated"],
  ["scripts/run-preview-tail-supervisor.ts", "delete_dedicated"],
  ["docs/reference/simple/scripts/run-preview-restore-readmission.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/run-preview-restore-readmission.md", "delete_dedicated"],
  ["docs/reference/simple/scripts/run-preview-tail-supervisor.md", "delete_dedicated"],
  ["docs/reference/technical/scripts/run-preview-tail-supervisor.md", "delete_dedicated"],

  [".github/workflows/preview.yml", "unwind_shared"],
  ["docs/operations/cost-review.md", "unwind_shared"],
  ["docs/operations/environments.md", "unwind_shared"],
  ["docs/operations/incident-runbook.md", "unwind_shared"],
  ["docs/operations/secrets.md", "unwind_shared"],
  ["docs/reference/simple/scripts/print-safe-tail.md", "unwind_shared"],
  ["docs/reference/simple/scripts/safe-tail-classifier.md", "unwind_shared"],
  ["docs/reference/simple/scripts/validate-preview-deploy-config.md", "unwind_shared"],
  ["docs/reference/simple/src/data/repositories/job-repository.md", "unwind_shared"],
  ["docs/reference/simple/src/jobs/create-daily-backup.md", "unwind_shared"],
  ["docs/reference/simple/src/jobs/scheduled.md", "unwind_shared"],
  ["docs/reference/simple/src/server/api/ai-category-proposal-routes.md", "unwind_shared"],
  ["docs/reference/simple/src/server/api/diagnostic-routes.md", "unwind_shared"],
  ["docs/reference/simple/src/server/client-binding-boundary.md", "unwind_shared"],
  ["docs/reference/simple/src/server/env.md", "unwind_shared"],
  ["docs/reference/simple/src/server/webhooks/google-calendar.md", "unwind_shared"],
  ["docs/reference/technical/scripts/print-safe-tail.md", "unwind_shared"],
  ["docs/reference/technical/scripts/safe-tail-classifier.md", "unwind_shared"],
  ["docs/reference/technical/scripts/validate-preview-deploy-config.md", "unwind_shared"],
  ["docs/reference/technical/src/data/repositories/job-repository.md", "unwind_shared"],
  ["docs/reference/technical/src/jobs/create-daily-backup.md", "unwind_shared"],
  ["docs/reference/technical/src/jobs/scheduled.md", "unwind_shared"],
  ["docs/reference/technical/src/server/api/ai-category-proposal-routes.md", "unwind_shared"],
  ["docs/reference/technical/src/server/api/diagnostic-routes.md", "unwind_shared"],
  ["docs/reference/technical/src/server/client-binding-boundary.md", "unwind_shared"],
  ["docs/reference/technical/src/server/env.md", "unwind_shared"],
  ["docs/reference/technical/src/server/webhooks/google-calendar.md", "unwind_shared"],
  ["scripts/print-safe-tail.ts", "unwind_shared"],
  ["scripts/safe-tail-classifier.ts", "unwind_shared"],
  ["scripts/validate-preview-deploy-config.ts", "unwind_shared"],
  ["src/data/repositories/job-repository.ts", "unwind_shared"],
  ["src/jobs/create-daily-backup.ts", "unwind_shared"],
  ["src/jobs/scheduled.ts", "unwind_shared"],
  ["src/server/api/ai-category-proposal-routes.ts", "unwind_shared"],
  ["src/server/api/diagnostic-routes.ts", "unwind_shared"],
  ["src/server/client-binding-boundary.ts", "unwind_shared"],
  ["src/server/env.ts", "unwind_shared"],
  ["src/server/webhooks/google-calendar.ts", "unwind_shared"],
  ["tests/e2e/foundation-diagnostics.spec.ts", "unwind_shared"],
  ["tests/integration/jobs/daily-backup.test.ts", "unwind_shared"],
  ["tests/integration/jobs/queue-deduplication.test.ts", "unwind_shared"],
  ["tests/security/secret-bundle.test.ts", "unwind_shared"],
  ["tests/unit/ci/workflows.test.ts", "unwind_shared"],
  ["tests/unit/scripts/print-safe-tail.test.ts", "unwind_shared"],
  ["tests/unit/scripts/production-deploy-config.test.ts", "unwind_shared"],
  ["tests/unit/scripts/safe-tail-classifier.test.ts", "unwind_shared"],
  ["tests/unit/server/env.test.ts", "unwind_shared"],
  ["tests/unit/server/wrangler-routing.test.ts", "unwind_shared"],
  ["tests/worker/ai-category-proposals.test.ts", "unwind_shared"],
  ["tests/worker/diagnostics.test.ts", "unwind_shared"],
  ["tests/worker/google-webhook.test.ts", "unwind_shared"],

  ["scripts/preview-acceptance-cleanup-inventory.ts", "retain_permanent"],
  ["docs/reference/simple/scripts/preview-acceptance-cleanup-inventory.md", "retain_permanent"],
  ["docs/reference/technical/scripts/preview-acceptance-cleanup-inventory.md", "retain_permanent"],
  ["scripts/run-preview-normal-deploy.ts", "retain_permanent"],
  ["tests/unit/scripts/preview-normal-deploy.test.ts", "retain_permanent"],
  ["docs/reference/simple/scripts/run-preview-normal-deploy.md", "retain_permanent"],
  ["docs/reference/technical/scripts/run-preview-normal-deploy.md", "retain_permanent"],
  ["scripts/privacy-safe-git-remote.ts", "retain_permanent"],
  ["tests/unit/scripts/privacy-safe-git-remote.test.ts", "retain_permanent"],
  ["docs/reference/simple/scripts/privacy-safe-git-remote.md", "retain_permanent"],
  ["docs/reference/technical/scripts/privacy-safe-git-remote.md", "retain_permanent"],
  ["scripts/scan-release.ts", "retain_permanent"],
  ["tests/security/r2-deletion-capability.test.ts", "retain_permanent"],
  ["docs/reference/simple/scripts/scan-release.md", "retain_permanent"],
  ["docs/reference/technical/scripts/scan-release.md", "retain_permanent"],
  ["tests/security/live-acceptance-closure.test.ts", "retain_permanent"],
  ["tests/security/temporary-surface-cleanup.test.ts", "retain_permanent"],
  ["docs/operations/phase-c-handoff.md", "retain_permanent"],
  ["docs/operations/phase-c-live-acceptance.md", "retain_permanent"],
  ["tests/unit/ci/workflow-yaml.test.ts", "retain_permanent"],
  ["src/jobs/calendar-maintenance-evidence.ts", "retain_permanent"],
  ["tests/unit/jobs/calendar-maintenance-evidence.test.ts", "retain_permanent"],
  ["docs/reference/simple/src/jobs/calendar-maintenance-evidence.md", "retain_permanent"],
  ["docs/reference/technical/src/jobs/calendar-maintenance-evidence.md", "retain_permanent"],

  [".superpowers/sdd/live-acceptance-runbook-audit.md", "retain_historical"],
  [".superpowers/sdd/fault-cleanup-plan-map-report.md", "retain_historical"],
  [".superpowers/sdd/live-acceptance-global-constraints.md", "retain_historical"],
  ["docs/superpowers/plans/2026-07-29-phase-b-live-acceptance-closure.md", "retain_historical"],
  ["docs/superpowers/specs/2026-07-29-phase-b-live-acceptance-closure-design.md", "retain_historical"],
  ["docs/superpowers/plans/2026-07-27-listener-before-activation-restore-retry.md", "retain_historical"],
  ["docs/superpowers/specs/2026-07-27-listener-before-activation-restore-retry-design.md", "retain_historical"],
  ["docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md", "retain_historical"],
  ["docs/superpowers/specs/2026-07-28-phase-b-acceptance-instrumentation-design.md", "retain_historical"],
  ["docs/operations/phase-b-evidence.md", "retain_historical"],
  ["docs/operations/cloudflare-support-review.md", "retain_historical"],
  ["docs/operations/calendar-setup-evidence.md", "retain_historical"],
  ["docs/operations/setbacks/INDEX.md", "retain_historical"],
] as const satisfies readonly (readonly [string, PhaseBAcceptancePathDisposition])[];

export const PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION = Object.freeze(
  LITERAL_PHASE_B_ACCEPTANCE_PATH_MAP.map(([path, disposition]) =>
    Object.freeze({ path, disposition }),
  ),
) satisfies readonly PhaseBAcceptancePathClassification[];

/** Projects one disposition from the single literal classification map. */
function pathsFor(disposition: PhaseBAcceptancePathDisposition): readonly string[] {
  return Object.freeze(
    PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION
      .filter((entry) => entry.disposition === disposition)
      .map((entry) => entry.path),
  );
}

export const DELETE_DEDICATED_PATHS = pathsFor("delete_dedicated");
export const UNWIND_SHARED_PATHS = pathsFor("unwind_shared");
export const RETAIN_PERMANENT_PATHS = pathsFor("retain_permanent");
export const RETAIN_HISTORICAL_PATHS = pathsFor("retain_historical");

const REVIEWED_CLASSIFICATION_COUNT = 186;
const REVIEWED_CLASSIFICATION_SHA256 =
  "cbe3feeb6fc46e45c8095b37daad69f61f6632c46b5f2c345d21341356ec13b5";

const REVIEWED_DISPOSITIONS = [
  "delete_dedicated",
  "unwind_shared",
  "retain_permanent",
  "retain_historical",
] as const satisfies readonly PhaseBAcceptancePathDisposition[];

export interface ClassificationDigest {
  readonly count: number;
  readonly sha256: string;
}

export type ClassificationDigestContract = Readonly<
  Record<"all" | PhaseBAcceptancePathDisposition, ClassificationDigest>
>;

/** Counts and SHA-256 fingerprints one newline-joined canonical line set. */
function digestOf(lines: readonly string[]): ClassificationDigest {
  return Object.freeze({
    count: lines.length,
    sha256: createHash("sha256").update(lines.join("\n")).digest("hex"),
  });
}

/** Projects one disposition's ordinal-sorted paths from sorted classification rows. */
function sortedPathsFor(
  rows: readonly PhaseBAcceptancePathClassification[],
  disposition: PhaseBAcceptancePathDisposition,
): readonly string[] {
  return rows.filter((entry) => entry.disposition === disposition).map(({ path }) => path);
}

/**
 * Recomputes every frozen digest the reviewed contract pins, so a reviewed
 * inventory change is refreshed from the literal map instead of by hand.
 */
export function classificationDigestContract(
  candidate: readonly PhaseBAcceptancePathClassification[],
): ClassificationDigestContract {
  const rows = [...candidate].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  return Object.freeze({
    all: digestOf(rows.map(({ path, disposition }) => `${path}\0${disposition}`)),
    delete_dedicated: digestOf(sortedPathsFor(rows, "delete_dedicated")),
    unwind_shared: digestOf(sortedPathsFor(rows, "unwind_shared")),
    retain_permanent: digestOf(sortedPathsFor(rows, "retain_permanent")),
    retain_historical: digestOf(sortedPathsFor(rows, "retain_historical")),
  });
}

/** Renders both frozen digest sites as paste-ready TypeScript constants. */
export function renderRefreshedDigests(
  contract: ClassificationDigestContract,
): string {
  return [
    "// scripts/preview-acceptance-cleanup-inventory.ts",
    `const REVIEWED_CLASSIFICATION_COUNT = ${contract.all.count};`,
    "const REVIEWED_CLASSIFICATION_SHA256 =",
    `  "${contract.all.sha256}";`,
    "",
    "// tests/security/temporary-surface-cleanup.test.ts",
    "const REVIEWED_CLASSIFICATION_CONTRACT = {",
    "  all: {",
    `    count: ${contract.all.count},`,
    `    sha256: "${contract.all.sha256}",`,
    "  },",
    ...REVIEWED_DISPOSITIONS.flatMap((disposition) => [
      `  ${disposition}: {`,
      `    count: ${contract[disposition].count},`,
      `    sha256: "${contract[disposition].sha256}",`,
      "  },",
    ]),
    "} as const;",
    "",
  ].join("\n");
}

/** Proves a candidate is the exact reviewed Task 1-8 path universe. */
export function validateReviewedPhaseBAcceptanceClassification(
  candidate: readonly PhaseBAcceptancePathClassification[],
): boolean {
  const paths = candidate.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) {
    return false;
  }
  const { all } = classificationDigestContract(candidate);
  return (
    all.count === REVIEWED_CLASSIFICATION_COUNT &&
    all.sha256 === REVIEWED_CLASSIFICATION_SHA256
  );
}

/** Returns the exact sorted paths Task 9 may delete or surgically unwind. */
export function task9ChangedPathManifest(): readonly string[] {
  return Object.freeze(
    [...DELETE_DEDICATED_PATHS, ...UNWIND_SHARED_PATHS].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

/** Writes the Task 9 manifest or the refreshed digests for the approved CLI modes. */
export function runCleanupInventoryCli(
  args: readonly string[],
  write: (value: string) => void,
): boolean {
  if (args.length !== 1) {
    return false;
  }
  if (args[0] === "--print-task-9-paths") {
    write(`${task9ChangedPathManifest().join("\n")}\n`);
    return true;
  }
  if (args[0] === "--refresh-digests") {
    write(
      renderRefreshedDigests(
        classificationDigestContract(PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION),
      ),
    );
    return true;
  }
  return false;
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const succeeded = runCleanupInventoryCli(process.argv.slice(2), (value) =>
    process.stdout.write(value),
  );
  if (!succeeded) {
    process.exitCode = 1;
  }
}
