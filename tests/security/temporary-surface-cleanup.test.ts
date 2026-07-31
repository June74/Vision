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

const REQUIRED_ACTIVE_OPERATIONS_RESIDUE = [
  {
    path: "docs/operations/cost-review.md",
    markers: [
      {
        name: "pending live category usage evidence",
        pattern:
          /one harmless live category request and aggregate usage evidence remain/u,
      },
      {
        name: "cost acceptance waits on live evidence",
        pattern:
          /Phase B is not cost-accepted until one harmless live\s+category request/u,
      },
      {
        name: "dedicated AI acceptance candidate",
        pattern: /The dedicated AI acceptance candidate/u,
      },
      {
        name: "same-run boolean enters generated candidate",
        pattern:
          /admits only that same-run success boolean into the generated candidate/u,
      },
      {
        name: "temporary ai_usage candidate boolean",
        pattern:
          /The boolean is temporary, server-only, and valid only for `ai_usage`/u,
      },
      {
        name: "AI candidate rollback",
        pattern: /The separate rollback must restore the normal artifact/u,
      },
      {
        name: "later candidate normal-state preflight",
        pattern:
          /Every later candidate must independently pass the fail-closed live normal-state\s+preflight/u,
      },
      {
        name: "remaining live OpenAI cost gate",
        pattern:
          /remaining\s+cost gate is a harmless live OpenAI category request/u,
      },
      {
        name: "pending guarded AI candidate",
        pattern: /guarded dedicated AI\s+candidate and verified normal rollback/u,
      },
    ],
  },
  {
    path: "docs/operations/environments.md",
    markers: [
      {
        name: "preview acceptance candidate guide",
        pattern: /## Preview acceptance candidates/u,
      },
      {
        name: "temporary acceptance dispatch boundary",
        pattern:
          /Temporary\s+acceptance work is available only from an explicit preview dispatch/u,
      },
      {
        name: "candidate observer dispatch",
        pattern: /Start `observe` by dispatching the workflow/u,
      },
      {
        name: "temporary candidate operation selectors",
        pattern: /`deploy_foundation`, `deploy_ai`, or `deploy_fault`/u,
      },
      {
        name: "candidate observer and expiry proof",
        pattern:
          /one exact `preview\.yml` observer run[\s\S]*revalidates the generated candidate's\s+expiry/u,
      },
      {
        name: "generated acceptance artifact",
        pattern: /`dist\/vision\/wrangler\.acceptance\.json`/u,
      },
      {
        name: "AI evidence candidate attestation",
        pattern:
          /The AI evidence candidate and `ai_stopped` fault[\s\S]*generated attestation\s+binding/u,
      },
      {
        name: "separate rollback dispatch",
        pattern: /dispatch `rollback` separately/u,
      },
      {
        name: "candidate-intent rollback ownership",
        pattern: /newest candidate-intent artifact/u,
      },
      {
        name: "rollback closure dispatch",
        pattern: /Dispatch\s+`close_rollback`/u,
      },
      {
        name: "cleanup lifecycle verification",
        pattern: /`verify_cleanup` enforces/u,
      },
      {
        name: "candidate rollback closure bounds",
        pattern:
          /Candidate deployment is bounded to 30 minutes,[\s\S]*cleanup verification to 10 minutes/u,
      },
      {
        name: "authenticated preview mutation gate",
        pattern: /## Authenticated read gate for preview mutation/u,
      },
      {
        name: "candidate-deploy authenticated reads",
        pattern: /Before selecting a candidate-deploy operation/u,
      },
      {
        name: "authenticated reads lifecycle parameter",
        pattern: /`authenticated_reads_gate=verified`/u,
      },
      {
        name: "temporary candidate recovery-window activation",
        pattern:
          /Temporary candidate activation is also blocked during the fail-closed UTC\s+window/u,
      },
      {
        name: "temporary scheduled candidate recheck",
        pattern: /Every temporary scheduled execution rechecks/u,
      },
      {
        name: "temporary one-minute route",
        pattern: /one-minute schedule/u,
      },
      {
        name: "operator candidate rollback checklist",
        pattern:
          /For a\s+temporary candidate, complete the observer, candidate, and separate rollback\s+sequence/u,
      },
    ],
  },
  {
    path: "docs/operations/incident-runbook.md",
    markers: [
      {
        name: "temporary candidate rollback playbook",
        pattern: /### Temporary preview candidate or rollback failure/u,
      },
      {
        name: "stop further candidate deployment",
        pattern: /Stop further candidate deployment/u,
      },
      {
        name: "candidate normal-state preflight",
        pattern: /Do not start another candidate[\s\S]*normal-state preflight/u,
      },
      {
        name: "generated deployment artifact recovery",
        pattern: /Do not create or patch a deployment artifact by hand/u,
      },
      {
        name: "same-run AI evidence candidate result",
        pattern:
          /dedicated AI evidence candidate requires its own same-run read-only result/u,
      },
      {
        name: "operator rollback action",
        pattern: /Dispatch `rollback` as a separate operator action/u,
      },
      {
        name: "candidate observer recheck",
        pattern:
          /workflow must repeat the exact workflow identity[\s\S]*immediately before candidate deployment/u,
      },
      {
        name: "temporary selector attestation schedule check",
        pattern: /temporary selector, AI attestation, and one-minute schedule/u,
      },
    ],
  },
  {
    path: "docs/operations/secrets.md",
    markers: [
      {
        name: "restore database Worker secret inventory",
        pattern: /`PREVIEW_RESTORE_DATABASE_URL`/u,
      },
      {
        name: "restore target Worker secret inventory",
        pattern: /`PREVIEW_RESTORE_TARGET_ID`/u,
      },
      {
        name: "temporary Worker secret lifecycle",
        pattern:
          /The two `PREVIEW_RESTORE_\*` entries are temporary, preview-only, and\s+target-only\./u,
      },
      {
        name: "approved Worker restore window",
        pattern: /configured only for an approved restore window/u,
      },
      {
        name: "local restore candidate preparation",
        pattern: /preparing this local candidate does not create one/u,
      },
    ],
  },
] as const;

const EXPECTED_ACTIVE_OPERATIONS_MARKER_COUNTS = {
  "docs/operations/cost-review.md": 9,
  "docs/operations/environments.md": 19,
  "docs/operations/incident-runbook.md": 8,
  "docs/operations/secrets.md": 5,
} as const;

const EXPECTED_ACTIVE_OPERATIONS_MARKER_NAMES = {
  "docs/operations/cost-review.md": [
    "pending live category usage evidence",
    "cost acceptance waits on live evidence",
    "dedicated AI acceptance candidate",
    "same-run boolean enters generated candidate",
    "temporary ai_usage candidate boolean",
    "AI candidate rollback",
    "later candidate normal-state preflight",
    "remaining live OpenAI cost gate",
    "pending guarded AI candidate",
  ],
  "docs/operations/environments.md": [
    "preview acceptance candidate guide",
    "temporary acceptance dispatch boundary",
    "candidate observer dispatch",
    "temporary candidate operation selectors",
    "candidate observer and expiry proof",
    "generated acceptance artifact",
    "AI evidence candidate attestation",
    "separate rollback dispatch",
    "candidate-intent rollback ownership",
    "rollback closure dispatch",
    "cleanup lifecycle verification",
    "candidate rollback closure bounds",
    "authenticated preview mutation gate",
    "candidate-deploy authenticated reads",
    "authenticated reads lifecycle parameter",
    "temporary candidate recovery-window activation",
    "temporary scheduled candidate recheck",
    "temporary one-minute route",
    "operator candidate rollback checklist",
  ],
  "docs/operations/incident-runbook.md": [
    "temporary candidate rollback playbook",
    "stop further candidate deployment",
    "candidate normal-state preflight",
    "generated deployment artifact recovery",
    "same-run AI evidence candidate result",
    "operator rollback action",
    "candidate observer recheck",
    "temporary selector attestation schedule check",
  ],
  "docs/operations/secrets.md": [
    "restore database Worker secret inventory",
    "restore target Worker secret inventory",
    "temporary Worker secret lifecycle",
    "approved Worker restore window",
    "local restore candidate preparation",
  ],
} as const;

const ACTIVE_OPERATIONS_SHARED_PATHS =
  REQUIRED_ACTIVE_OPERATIONS_RESIDUE.map(({ path }) => path);

const RETAINED_HISTORICAL_OPERATIONS = [
  {
    path: "docs/operations/calendar-setup-evidence.md",
    anchors: [
      {
        name: "calendar evidence heading",
        pattern: /# Disposable calendar acceptance evidence/u,
      },
      {
        name: "redacted evidence template",
        pattern: /## Redacted evidence template/u,
      },
    ],
  },
  {
    path: "docs/operations/cloud-integration-debugging-retrospective.md",
    anchors: [
      {
        name: "debugging retrospective heading",
        pattern: /# Cloud integration debugging retrospective/u,
      },
      { name: "outcome section", pattern: /## Outcome/u },
      {
        name: "confirmed root causes",
        pattern: /confirmed root causes/u,
      },
    ],
  },
  {
    path: "docs/operations/credential-change-log.md",
    anchors: [
      {
        name: "credential history heading",
        pattern: /# Credential and key change log/u,
      },
      {
        name: "backup key history",
        pattern: /`BACKUP_ENCRYPTION_KEY`/u,
      },
      {
        name: "restore database history",
        pattern: /`PREVIEW_RESTORE_DATABASE_URL`/u,
      },
      {
        name: "restore target history",
        pattern: /`PREVIEW_RESTORE_TARGET_ID`/u,
      },
    ],
  },
  {
    path: "docs/operations/phase-b-evidence.md",
    anchors: [
      {
        name: "release evidence heading",
        pattern: /# Phase B completion evidence/u,
      },
      {
        name: "wave-two lifetime qualification",
        pattern:
          /full-lifetime recovery-exclusion claim was incomplete for the 06:05 route/u,
      },
      {
        name: "wave-three superseding evidence",
        pattern: /Local final-fix wave 3/u,
      },
    ],
  },
  {
    path: "docs/operations/phase-b-implementation-setbacks.md",
    anchors: [
      {
        name: "implementation setbacks heading",
        pattern: /# Phase B implementation setbacks/u,
      },
      { name: "status meanings", pattern: /Status meanings:/u },
      { name: "AI budget history", pattern: /## AI budget Task 3/u },
    ],
  },
  {
    path: "docs/operations/phase-b-progress-simple.md",
    anchors: [
      { name: "simple progress heading", pattern: /# Phase B Progress/u },
      { name: "current milestone", pattern: /## Current milestone/u },
    ],
  },
  {
    path: "docs/operations/phase-b-progress-technical.md",
    anchors: [
      { name: "technical progress heading", pattern: /# Phase B Progress/u },
      { name: "runtime task history", pattern: /## Runtime Task 1/u },
      { name: "implementation commit history", pattern: /Implementation commit:/u },
    ],
  },
  {
    path: "docs/operations/restore-drill.md",
    anchors: [
      {
        name: "restore evidence heading",
        pattern: /# Phase B encrypted restore drill/u,
      },
      {
        name: "live overwrite prohibition",
        pattern: /\*\*Live branch overwrite:\*\* Forbidden/u,
      },
      {
        name: "historical restore variable",
        pattern: /`PREVIEW_RESTORE_DATABASE_URL`/u,
      },
      { name: "drill result section", pattern: /## Result/u },
    ],
  },
] as const;

const RETAINED_HISTORICAL_OPERATIONS_PATHS =
  RETAINED_HISTORICAL_OPERATIONS.map(({ path }) => path);

const RETAINED_HISTORICAL_OPERATIONS_ROOTS = [
  "docs/operations/setbacks",
] as const;

const PERMANENT_OPERATIONS_REFERENCE_PATHS = [
  "docs/operations/backup-and-restore.md",
  "docs/operations/github-action-pins.md",
  "docs/operations/google-oauth-setup.md",
] as const;

const ACTIVE_OPERATIONS_PATHS = [
  ...ACTIVE_OPERATIONS_SHARED_PATHS,
  ...PERMANENT_OPERATIONS_REFERENCE_PATHS,
] as const;

const ACTIVE_OPERATIONS_CONTENT_ANCHORS = [
  {
    path: "docs/operations/cost-review.md",
    anchors: [
      { name: "cost review heading", pattern: /# Phase B cost review/u },
      {
        name: "permanent AI hard stop",
        pattern: /Every new AI request stops at 950 cents/u,
      },
      { name: "provider references", pattern: /## Provider references/u },
    ],
  },
  {
    path: "docs/operations/environments.md",
    anchors: [
      {
        name: "environment guide heading",
        pattern: /# Vision deployment environments/u,
      },
      {
        name: "production prerequisites",
        pattern: /## External production prerequisites/u,
      },
      {
        name: "production confirmation",
        pattern: /DEPLOY VISION PRODUCTION/u,
      },
    ],
  },
  {
    path: "docs/operations/incident-runbook.md",
    anchors: [
      {
        name: "incident runbook heading",
        pattern: /# Phase B incident runbook/u,
      },
      { name: "first response", pattern: /## First response/u },
      { name: "permanent AI budget stop", pattern: /### AI budget stop/u },
    ],
  },
  {
    path: "docs/operations/secrets.md",
    anchors: [
      { name: "secret guide heading", pattern: /# Vision secret handling/u },
      { name: "permanent AI secret", pattern: /`OPENAI_API_KEY`/u },
      {
        name: "permanent backup key",
        pattern: /`BACKUP_ENCRYPTION_KEY`/u,
      },
    ],
  },
  {
    path: "docs/operations/backup-and-restore.md",
    anchors: [
      {
        name: "offline restore heading",
        pattern: /# Encrypted backup and preview restore/u,
      },
      { name: "backup namespace", pattern: /`backups\/v1\//u },
      {
        name: "offline restore database variable",
        pattern: /`PREVIEW_RESTORE_DATABASE_URL`/u,
      },
      {
        name: "offline restore target variable",
        pattern: /`PREVIEW_RESTORE_TARGET_ID`/u,
      },
      {
        name: "operator process-variable context",
        pattern:
          /The restore process additionally reads:[\s\S]*\| Process variable \| Purpose \|[\s\S]*These values belong in the operator environment/u,
      },
    ],
  },
  {
    path: "docs/operations/github-action-pins.md",
    anchors: [
      {
        name: "action pins heading",
        pattern: /# GitHub Actions immutable pins/u,
      },
      { name: "immutable commit column", pattern: /Immutable commit/u },
      { name: "checkout pin", pattern: /actions\/checkout/u },
    ],
  },
  {
    path: "docs/operations/google-oauth-setup.md",
    anchors: [
      {
        name: "OAuth setup heading",
        pattern: /# Preview Google OAuth setup/u,
      },
      { name: "approval boundary", pattern: /## Required approval/u },
      {
        name: "post-acceptance revocation",
        pattern: /After acceptance, revoke/u,
      },
    ],
  },
] as const;

const EXPECTED_ACTIVE_OPERATIONS_ANCHOR_NAMES = {
  "docs/operations/cost-review.md": [
    "cost review heading",
    "permanent AI hard stop",
    "provider references",
  ],
  "docs/operations/environments.md": [
    "environment guide heading",
    "production prerequisites",
    "production confirmation",
  ],
  "docs/operations/incident-runbook.md": [
    "incident runbook heading",
    "first response",
    "permanent AI budget stop",
  ],
  "docs/operations/secrets.md": [
    "secret guide heading",
    "permanent AI secret",
    "permanent backup key",
  ],
  "docs/operations/backup-and-restore.md": [
    "offline restore heading",
    "backup namespace",
    "offline restore database variable",
    "offline restore target variable",
    "operator process-variable context",
  ],
  "docs/operations/github-action-pins.md": [
    "action pins heading",
    "immutable commit column",
    "checkout pin",
  ],
  "docs/operations/google-oauth-setup.md": [
    "OAuth setup heading",
    "approval boundary",
    "post-acceptance revocation",
  ],
} as const;

const EXPECTED_HISTORICAL_OPERATIONS_ANCHOR_NAMES = {
  "docs/operations/calendar-setup-evidence.md": [
    "calendar evidence heading",
    "redacted evidence template",
  ],
  "docs/operations/cloud-integration-debugging-retrospective.md": [
    "debugging retrospective heading",
    "outcome section",
    "confirmed root causes",
  ],
  "docs/operations/credential-change-log.md": [
    "credential history heading",
    "backup key history",
    "restore database history",
    "restore target history",
  ],
  "docs/operations/phase-b-evidence.md": [
    "release evidence heading",
    "wave-two lifetime qualification",
    "wave-three superseding evidence",
  ],
  "docs/operations/phase-b-implementation-setbacks.md": [
    "implementation setbacks heading",
    "status meanings",
    "AI budget history",
  ],
  "docs/operations/phase-b-progress-simple.md": [
    "simple progress heading",
    "current milestone",
  ],
  "docs/operations/phase-b-progress-technical.md": [
    "technical progress heading",
    "runtime task history",
    "implementation commit history",
  ],
  "docs/operations/restore-drill.md": [
    "restore evidence heading",
    "live overwrite prohibition",
    "historical restore variable",
    "drill result section",
  ],
} as const;

const OFFLINE_RESTORE_VARIABLE_NAMES = [
  "PREVIEW_RESTORE_DATABASE_URL",
  "PREVIEW_RESTORE_TARGET_ID",
] as const;

const OFFLINE_RESTORE_VARIABLE_MANUAL =
  "docs/operations/backup-and-restore.md";

const FORBIDDEN_OFFLINE_RESTORE_RUNTIME_CONTEXT_PATTERNS = [
  /`PREVIEW_RESTORE_(?:DATABASE_URL|TARGET_ID)`[^\r\n]{0,160}\b(?:Cloudflare (?:Worker )?secret|Worker runtime|Worker secret)\b/iu,
  /\b(?:Cloudflare (?:Worker )?secret|Worker runtime|Worker secret)\b[^\r\n]{0,160}`PREVIEW_RESTORE_(?:DATABASE_URL|TARGET_ID)`/iu,
] as const;

const ACTIVE_OPERATIONS_PORTABLE_RESIDUE_PATTERNS = [
  /\b(?:deploy_foundation|deploy_ai|deploy_fault)\b/u,
  /\b(?:close_rollback|verify_cleanup|authenticated_reads_gate)\b/u,
  /wrangler\.acceptance\.json/u,
  /candidate-intent artifact/u,
  /one-minute schedule/u,
  /AI evidence (?:candidate|operation)/u,
  /\b(?:acceptance|dedicated|generated|guarded|later|local|newest|pre-candidate|temporary)\b[^.]{0,120}\bcandidate\b/iu,
  /\bcandidate\b[^.]{0,120}(?:observer|selector|attestation|expiry|lifetime|preflight|artifact|closure)/iu,
  /(?:observer|attestation|selector)[^.]{0,120}\bcandidate\b/iu,
  /\bcandidate\b[^.]{0,120}\b(?:rollback|rolled back)\b/iu,
  /\brollback\b[^.]{0,120}\bcandidate\b/iu,
  /temporary (?:selector|binding|scheduled execution)/iu,
  /same-run (?:success boolean|read-only result)/iu,
  /provider cleanup is last/iu,
  /(?:before every preview AI acceptance|preview AI gate)/iu,
  /The two `PREVIEW_RESTORE_\*` entries are temporary/iu,
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
  ...ACTIVE_OPERATIONS_SHARED_PATHS,
  "docs/reference/simple/scripts/safe-tail-classifier.md",
  "docs/reference/simple/scripts/validate-preview-deploy-config.md",
  "docs/reference/simple/src/jobs/scheduled.md",
  "docs/reference/simple/src/jobs/temporary-preview-restore-production.md",
  "docs/reference/simple/src/server/api/ai-category-proposal-routes.md",
  "docs/reference/simple/src/server/api/diagnostic-routes.md",
  "docs/reference/simple/src/server/client-binding-boundary.md",
  "docs/reference/simple/src/server/env.md",
  "docs/reference/technical/scripts/safe-tail-classifier.md",
  "docs/reference/technical/scripts/validate-preview-deploy-config.md",
  "docs/reference/technical/src/jobs/scheduled.md",
  "docs/reference/technical/src/jobs/temporary-preview-restore-production.md",
  "docs/reference/technical/src/server/api/ai-category-proposal-routes.md",
  "docs/reference/technical/src/server/api/diagnostic-routes.md",
  "docs/reference/technical/src/server/client-binding-boundary.md",
  "docs/reference/technical/src/server/env.md",
  "scripts/print-safe-tail.ts",
  "scripts/run-preview-acceptance-controller.ts",
  "scripts/safe-tail-classifier.ts",
  "scripts/validate-preview-deploy-config.ts",
  "src/jobs/scheduled.ts",
  "src/jobs/temporary-preview-restore-production.ts",
  "src/server/api/ai-category-proposal-routes.ts",
  "src/server/api/diagnostic-routes.ts",
  "src/server/client-binding-boundary.ts",
  "src/server/env.ts",
  "src/server/webhooks/temporary-preview-sync-suppression.ts",
  "tests/e2e/foundation-diagnostics.spec.ts",
  "tests/integration/jobs/daily-backup.test.ts",
  "tests/integration/jobs/temporary-preview-acceptance-routing.test.ts",
  "tests/security/secret-bundle.test.ts",
  "tests/unit/ci/workflows.test.ts",
  "tests/unit/scripts/preview-acceptance-context.test.ts",
  "tests/unit/scripts/preview-acceptance-controller.test.ts",
  "tests/unit/scripts/preview-tail-supervisor.test.ts",
  "tests/unit/scripts/print-safe-tail.test.ts",
  "tests/unit/scripts/production-deploy-config.test.ts",
  "tests/unit/scripts/safe-tail-classifier.test.ts",
  "tests/unit/server/env.test.ts",
  "tests/unit/server/temporary-preview-sync-suppression.test.ts",
  "tests/unit/server/wrangler-routing.test.ts",
  "tests/worker/diagnostics.test.ts",
  "tests/worker/google-webhook.test.ts",
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
  ...ACTIVE_OPERATIONS_SHARED_PATHS,
  ...PERMANENT_OPERATIONS_REFERENCE_PATHS,
  ...RETAINED_HISTORICAL_OPERATIONS_PATHS,
  ...RETAINED_HISTORICAL_OPERATIONS_ROOTS,
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

async function listActiveOperationsResidue(): Promise<
  Array<{ path: string; markers: string[] }>
> {
  return (
    await Promise.all(
      REQUIRED_ACTIVE_OPERATIONS_RESIDUE.map(async ({ path, markers }) => {
        const source = await read(path);
        return {
          path,
          markers: markers
            .filter(({ pattern }) => pattern.test(source))
            .map(({ name }) => name),
        };
      }),
    )
  ).filter(({ markers }) => markers.length > 0);
}

async function listActiveOperationsPortableResidue(): Promise<string[]> {
  return (
    await Promise.all(
      ACTIVE_OPERATIONS_PATHS.map(async (path) => ({
        path,
        source: await read(path),
      })),
    )
  )
    .filter(({ source }) => containsActiveOperationsPortableResidue(source))
    .map(({ path }) => path);
}

function containsActiveOperationsPortableResidue(source: string): boolean {
  const normalized = source.replace(/\s+/gu, " ");
  return ACTIVE_OPERATIONS_PORTABLE_RESIDUE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

async function listUnexpectedActiveOperationsRestoreVariables(): Promise<
  Array<{ path: string; variables: string[] }>
> {
  return (
    await Promise.all(
      ACTIVE_OPERATIONS_PATHS.filter(
        (path) => path !== OFFLINE_RESTORE_VARIABLE_MANUAL,
      ).map(async (path) => {
        const source = await read(path);
        return {
          path,
          variables: OFFLINE_RESTORE_VARIABLE_NAMES.filter((name) =>
            source.includes(name),
          ),
        };
      }),
    )
  ).filter(({ variables }) => variables.length > 0);
}

type OperationsContentContract = readonly {
  readonly path: string;
  readonly anchors: readonly {
    readonly name: string;
    readonly pattern: RegExp;
  }[];
}[];

async function listMatchedOperationsAnchors(
  contract: OperationsContentContract,
): Promise<Array<{ path: string; anchors: string[] }>> {
  return Promise.all(
    contract.map(async ({ path, anchors }) => {
      const source = await read(path);
      return {
        path,
        anchors: anchors
          .filter(({ pattern }) => pattern.test(source))
          .map(({ name }) => name),
      };
    }),
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
  const generalResidue = (
    await Promise.all(
      activePaths.map(async (path) => ({
        path,
        source: await read(path),
      })),
    )
  )
    .filter(({ source }) => containsTemporaryActiveSurface(source))
    .map(({ path }) => path);
  const operationsResidue = (await listActiveOperationsResidue()).map(
    ({ path }) => path,
  );
  const portableOperationsResidue =
    await listActiveOperationsPortableResidue();
  const unexpectedRestoreVariableResidue = (
    await listUnexpectedActiveOperationsRestoreVariables()
  ).map(({ path }) => path);
  return [
    ...new Set([
      ...generalResidue,
      ...operationsResidue,
      ...portableOperationsResidue,
      ...unexpectedRestoreVariableResidue,
    ]),
  ].sort();
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

    expect(simple).toContain("The nine");
    expect(simple).toContain("temporary selectors are preview-only");
    expect(simple).toContain("temporary Gateway attestation");
    expect(simple).toContain("temporary restore database");
    expect(technical).toContain("PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED");
    expect(technical).toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(
      [simple, technical].filter(containsTemporaryActiveSurface),
    ).toEqual([simple, technical]);
  });

  it("tracks active operations instructions as content-level shared cleanup without scanning retained history", async () => {
    const currentResidue = await listActiveOperationsResidue();
    const portableResidue = await listActiveOperationsPortableResidue();
    const unexpectedRestoreVariables =
      await listUnexpectedActiveOperationsRestoreVariables();
    const expectedCurrentResidue = REQUIRED_ACTIVE_OPERATIONS_RESIDUE.map(
      ({ path, markers }) => ({
        path,
        markers: markers.map(({ name }) => name),
      }),
    );
    const activeContentAnchors = await listMatchedOperationsAnchors(
      ACTIVE_OPERATIONS_CONTENT_ANCHORS,
    );
    const historicalContentAnchors = await listMatchedOperationsAnchors(
      RETAINED_HISTORICAL_OPERATIONS,
    );
    const offlineRestoreManual = await read(OFFLINE_RESTORE_VARIABLE_MANUAL);
    const portablePatternRepresentatives = [
      'operation: "deploy_foundation"',
      "`close_rollback` must prove closure",
      "`dist/vision/wrangler.acceptance.json`",
      "newest candidate-intent artifact",
      "temporary one-minute schedule",
      "dedicated AI evidence candidate",
      "Deploy the temporary\ncandidate after review",
      "The candidate waits until the\nobserver is active",
      "The observer must authorize the\ncandidate",
      "The candidate requires a\nseparate rollback after evidence",
      "Rollback must identify the\ncandidate before closure",
      "temporary selector",
      "same-run success boolean",
      "Provider cleanup is last",
      "preview AI gate",
      "The two `PREVIEW_RESTORE_*` entries are temporary",
    ];
    const permanentPortableVocabulary = [
      "Review the permanent release candidate before production deployment.",
      "The offline restore command uses a database attestation.",
      "Normal rollback planning remains an operator responsibility.",
    ];
    const forbiddenOfflineRuntimeRepresentatives = [
      "`PREVIEW_RESTORE_DATABASE_URL` is a Cloudflare Worker secret",
      "Worker runtime reads `PREVIEW_RESTORE_TARGET_ID`",
    ];
    const historicalPaths = new Set<string>(
      RETAINED_HISTORICAL_OPERATIONS_PATHS,
    );
    const classifiedTopLevelOperationsDocs = [
      ...ACTIVE_OPERATIONS_SHARED_PATHS,
      ...PERMANENT_OPERATIONS_REFERENCE_PATHS,
      ...RETAINED_HISTORICAL_OPERATIONS_PATHS,
    ].sort();
    const actualTopLevelOperationsDocs = (
      await readdir(resolve(process.cwd(), "docs/operations"), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `docs/operations/${entry.name}`)
      .sort();

    expect(currentResidue).toEqual(
      STRICT_CLEANUP ? [] : expectedCurrentResidue,
    );
    expect(portableResidue).toEqual(
      STRICT_CLEANUP ? [] : ACTIVE_OPERATIONS_SHARED_PATHS,
    );
    expect(unexpectedRestoreVariables).toEqual(
      STRICT_CLEANUP
        ? []
        : [
            {
              path: "docs/operations/secrets.md",
              variables: [
                "PREVIEW_RESTORE_DATABASE_URL",
                "PREVIEW_RESTORE_TARGET_ID",
              ],
            },
          ],
    );
    expect(
      Object.fromEntries(
        activeContentAnchors.map(({ path, anchors }) => [path, anchors]),
      ),
    ).toEqual(EXPECTED_ACTIVE_OPERATIONS_ANCHOR_NAMES);
    expect(
      Object.fromEntries(
        historicalContentAnchors.map(({ path, anchors }) => [path, anchors]),
      ),
    ).toEqual(EXPECTED_HISTORICAL_OPERATIONS_ANCHOR_NAMES);
    expect(
      portablePatternRepresentatives.filter(
        (source, index) =>
          !ACTIVE_OPERATIONS_PORTABLE_RESIDUE_PATTERNS[index]?.test(
            source.replace(/\s+/gu, " "),
          ),
      ),
    ).toEqual([]);
    expect(
      permanentPortableVocabulary.filter(
        containsActiveOperationsPortableResidue,
      ),
    ).toEqual([]);
    expect(
      FORBIDDEN_OFFLINE_RESTORE_RUNTIME_CONTEXT_PATTERNS.filter((pattern) =>
        pattern.test(offlineRestoreManual),
      ),
    ).toEqual([]);
    expect(
      forbiddenOfflineRuntimeRepresentatives.filter(
        (source, index) =>
          !FORBIDDEN_OFFLINE_RESTORE_RUNTIME_CONTEXT_PATTERNS[index]?.test(
            source,
          ),
      ),
    ).toEqual([]);
    expect(
      Object.fromEntries(
        REQUIRED_ACTIVE_OPERATIONS_RESIDUE.map(({ path, markers }) => [
          path,
          markers.map(({ name }) => name),
        ]),
      ),
    ).toEqual(EXPECTED_ACTIVE_OPERATIONS_MARKER_NAMES);
    const exactMarkerPatterns = REQUIRED_ACTIVE_OPERATIONS_RESIDUE.flatMap(
      ({ markers }) => markers.map(({ pattern }) => pattern),
    );
    expect(new Set(exactMarkerPatterns.map(({ source }) => source))).toHaveLength(
      41,
    );
    expect(exactMarkerPatterns.filter((pattern) => pattern.test(""))).toEqual(
      [],
    );
    expect(ACTIVE_OPERATIONS_SHARED_PATHS).toHaveLength(4);
    expect(RETAINED_HISTORICAL_OPERATIONS_PATHS).toHaveLength(8);
    expect(PERMANENT_OPERATIONS_REFERENCE_PATHS).toHaveLength(3);
    expect(ACTIVE_OPERATIONS_PATHS).toHaveLength(7);
    expect(ACTIVE_OPERATIONS_PORTABLE_RESIDUE_PATTERNS).toHaveLength(16);
    expect(
      new Set(
        ACTIVE_OPERATIONS_PORTABLE_RESIDUE_PATTERNS.map(
          ({ source }) => source,
        ),
      ),
    ).toHaveLength(16);
    expect(
      FORBIDDEN_OFFLINE_RESTORE_RUNTIME_CONTEXT_PATTERNS,
    ).toHaveLength(2);
    expect(
      Object.fromEntries(
        REQUIRED_ACTIVE_OPERATIONS_RESIDUE.map(({ path, markers }) => [
          path,
          markers.length,
        ]),
      ),
    ).toEqual(EXPECTED_ACTIVE_OPERATIONS_MARKER_COUNTS);
    expect(
      REQUIRED_ACTIVE_OPERATIONS_RESIDUE.reduce(
        (total, { markers }) => total + markers.length,
        0,
      ),
    ).toBe(41);
    expect(
      Object.fromEntries(
        ACTIVE_OPERATIONS_CONTENT_ANCHORS.map(({ path, anchors }) => [
          path,
          anchors.length,
        ]),
      ),
    ).toEqual({
      "docs/operations/cost-review.md": 3,
      "docs/operations/environments.md": 3,
      "docs/operations/incident-runbook.md": 3,
      "docs/operations/secrets.md": 3,
      "docs/operations/backup-and-restore.md": 5,
      "docs/operations/github-action-pins.md": 3,
      "docs/operations/google-oauth-setup.md": 3,
    });
    expect(
      Object.fromEntries(
        RETAINED_HISTORICAL_OPERATIONS.map(({ path, anchors }) => [
          path,
          anchors.length,
        ]),
      ),
    ).toEqual({
      "docs/operations/calendar-setup-evidence.md": 2,
      "docs/operations/cloud-integration-debugging-retrospective.md": 3,
      "docs/operations/credential-change-log.md": 4,
      "docs/operations/phase-b-evidence.md": 3,
      "docs/operations/phase-b-implementation-setbacks.md": 3,
      "docs/operations/phase-b-progress-simple.md": 2,
      "docs/operations/phase-b-progress-technical.md": 3,
      "docs/operations/restore-drill.md": 4,
    });
    expect(
      EXPECTED_SHARED_RESIDUE_PATHS.filter((path) =>
        path.startsWith("docs/operations/"),
      ),
    ).toEqual(ACTIVE_OPERATIONS_SHARED_PATHS);
    expect(classifiedTopLevelOperationsDocs).toEqual(
      actualTopLevelOperationsDocs,
    );
    expect(
      ACTIVE_OPERATIONS_SHARED_PATHS.filter((path) =>
        historicalPaths.has(path),
      ),
    ).toEqual([]);
    expect(
      ACTIVE_OPERATIONS_SHARED_PATHS.filter((path) =>
        RETAINED_HISTORICAL_OPERATIONS_ROOTS.some(
          (root) => path.startsWith(`${root}/`),
        ),
      ),
    ).toEqual([]);
    expect(PERMANENT_PATHS).toEqual(
      expect.arrayContaining([
        ...ACTIVE_OPERATIONS_SHARED_PATHS,
        ...RETAINED_HISTORICAL_OPERATIONS_PATHS,
        ...RETAINED_HISTORICAL_OPERATIONS_ROOTS,
      ]),
    );
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
    expect(EXPECTED_SHARED_RESIDUE_PATHS).toHaveLength(48);
    expect(new Set(EXPECTED_SHARED_RESIDUE_PATHS)).toHaveLength(48);
    expect(new Set(PERMANENT_PATHS)).toHaveLength(PERMANENT_PATHS.length);
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
      offlineRestoreManual,
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
      read("docs/operations/backup-and-restore.md"),
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
    expect(maintenance).toContain("vision.calendar-maintenance/v2");
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
    expect(credentialHistory).toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(credentialHistory).toContain("PREVIEW_RESTORE_TARGET_ID");
    expect(offlineRestoreManual).toContain("PREVIEW_RESTORE_DATABASE_URL");
    expect(offlineRestoreManual).toContain("PREVIEW_RESTORE_TARGET_ID");
    expect(releaseEvidence).toContain("# Phase B completion evidence");
  });
});
