# Phase B Live-Acceptance Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining privacy-safe Phase B acceptance seams, prove
the reviewed preview behavior live, remove every temporary surface, restore the
normal Worker, clean disposable provider artifacts in replay-safe order, and
complete the Phase B evidence and handoff.

**Architecture:** Extend only confirmed live paths. A dedicated preview-only
selector suppresses one fully authenticated Google `exists` notification after
a read-only replay check, while the existing Queue, consumer, sync, and
quarter-hour repair paths remain unchanged. AI evidence is admitted only at one
canonical scheduled instant after an owner-scoped aggregate proves one exact
`settled` request. A local controller retains observer handles in memory,
workflows deploy only immutable reviewed artifacts, and permanent structural
tests constrain R2 deletion to the two owner-approved recovery paths.

**Tech Stack:** TypeScript, React, Hono, Cloudflare Workers, Queues and R2,
Neon PostgreSQL, Drizzle ORM, Zod, Vitest, Playwright, GitHub Actions, Wrangler,
PowerShell, and pnpm.

## Global Constraints

- Work only in the existing `codex/phase-b-foundation` linked worktree.
- Before Task 1, commit and push this independently reviewed plan and its
  approved design spec as one authoring prerequisite. Perform the remote-tip
  query and push through a controller-owned argument-array process adapter that
  captures and discards child stdout/stderr, validates exit status and the
  exact one-line canonical 40-hex result internally, and emits only a closed
  Boolean or a constant safe error. Prove boolean-only local/remote equality
  and record that authoring commit in the SDD ledger.
  Tasks 1-10 treat both paths as immutable retained history: no task edits,
  stages, or recommits them. Task 6 and Task 7 require zero diff for both paths
  against that authoring commit before the candidate can freeze.
- Every later remote Git tip query or push uses the same privacy boundary,
  through either the temporary controller or the permanent tested safe-Git
  adapter introduced in Task 6. No direct `git ls-remote` or `git push` may
  inherit or print child output; URLs and command arguments remain unread and
  unrecorded even on failure.
- Use RED, GREEN, refactor for every behavior change. An expected RED failure
  is test evidence; an unexpected failure is logged before work continues.
- Use a fresh implementation subagent and an independent specification and
  quality reviewer for each implementation task.
- Add no database migration, public operator route, production UI control,
  Queue, provider resource, or durable acceptance state.
- Never read, print, request, copy, rotate, or expose secret values,
  authorization values, account data, event content, prompts, responses,
  provider identifiers, object keys, database rows, or URLs.
- Keep the backup key at version `1`; do not rotate it.
- Temporary acceptance source, scripts, workflows, controllers, and cleanup
  code must have zero R2 deletion capability.
- Permanent failed-verification cleanup may delete only the object created by
  that same invocation. Permanent retention may delete only independently
  validated objects at or beyond the approved 30-day boundary.
- Normal preview and production have exactly two schedules: quarter-hour
  calendar maintenance and daily recovery.
- The sync-suppression candidate also has exactly those two schedules.
- Existing foundation, AI, and six fault candidates retain the temporary
  one-minute schedule in addition to the two normal schedules.
- Temporary current-workflow role-probe and restore candidates also use that
  one-minute schedule plus the two normal schedules and are removed in Task 9.
- `sync_suppression` is an acceptance selector and never a seventh member of
  `TEMPORARY_PREVIEW_FAULT_SCENARIOS`.
- A candidate is observer-first, preview-only, immutable-ref-bound, bounded by
  the protected recovery window, and followed by separately dispatched normal
  rollback, signed-in reads, and rollback closure.
- The AI route continues accepting only its existing event reference and
  idempotency input. It constructs its prompt server-side; acceptance never
  supplies or reads the prompt.
- Use `CLOUDFLARE_ENV=preview` for every preview build used as deployment
  evidence.
- Update simple and technical references for every created or changed
  production file or named export.
- Task 9 removes every temporary acceptance source, test, selector, binding,
  resolver, controller, workflow mode, evidence family, reference, and active
  instruction while retaining permanent recovery, security, and maintenance
  behavior.
- Provider cleanup order is fixed: reviewed cleanup deploy, normal proofs,
  disposable Neon branch deletion and absence proof, then replay-marker
  deletion last.

## File Structure and Ownership

### Temporary sync-suppression surfaces

- Create `src/server/webhooks/temporary-preview-sync-suppression.ts` for the
  closed selector state and two-key content-free evidence producer.
- Create `scripts/validate-preview-sync-acceptance.ts` for pure five/four-minute,
  normal-sync, and repair-tick calculations.
- Create `scripts/resolve-preview-observer-run.ts` for bounded metadata-only
  observer discovery.
- Create `scripts/run-preview-acceptance-controller.ts` for in-memory observer
  handle retention and guarded dispatch composition.
- Create `src/jobs/temporary-preview-restore-production.ts` to wire the existing
  fenced restore engine into the reviewed current workflow without reviving an
  immutable historical workflow.

### Existing shared surfaces

- `src/domain/operations/temporary-preview-fault.ts` remains the canonical
  temporary selector and lifetime parser.
- `scripts/prepare-preview-acceptance-deploy-config.ts` remains the only
  candidate artifact builder and workflow-input validator.
- `scripts/validate-preview-deploy-config.ts` remains the exact normal and
  candidate artifact validator.
- `src/server/webhooks/google-calendar.ts` owns the post-authenticity
  suppression seam.
- `src/data/repositories/job-repository.ts` owns the read-only replay
  inspection.
- `scripts/safe-tail-classifier.ts`, `scripts/print-safe-tail.ts`, and
  `scripts/validate-preview-observer-state.ts` own content-free observation.
- `.github/workflows/preview.yml` owns guarded observer, candidate, rollback,
  closure, and cleanup admission.

### Temporary AI-acceptance surfaces

- `src/data/phase-b-ai-usage-source.ts` owns aggregate-only active and eligible
  request counts.
- `src/server/api/diagnostic-routes.ts` exposes those counts only on the
  existing authenticated preview diagnostics response.
- `src/jobs/scheduled.ts` admits only the exact AI evidence instant before it
  constructs database dependencies.
- `src/jobs/phase-b-ai-usage-evidence.ts` retains the existing fixed terminal
  record and receives the eligibility gate.

### Permanent enforcement surfaces

- Extend `scripts/scan-release.ts` with path-scoped R2 deletion capability
  validation.
- Create `scripts/run-preview-normal-deploy.ts` as the permanent,
  privacy-safe owner of exact-commit normal preview dispatch, bounded run
  resolution, and deployment-attribution validation after acceptance cleanup.
- Create `scripts/privacy-safe-git-remote.ts` as the permanent argument-array
  adapter for remote-tip comparison and exact-commit push. It captures and
  discards child output and exposes only closed booleans or constant errors.
- Create `tests/security/r2-deletion-capability.test.ts`.
- Create `tests/security/live-acceptance-closure.test.ts`.
- Retain both tests after Task 9.
- Extend `tests/security/temporary-surface-cleanup.test.ts` with the exact
  temporary inventory; keep it permanently as the post-cleanup residue guard.

---

## Task 1: Add Selector-Specific Candidate Timing and Exact Artifacts

**Files:**

- Modify: `src/domain/operations/temporary-preview-fault.ts`
- Modify: `src/server/env.ts`
- Verify/modify: `src/server/client-binding-boundary.ts`
- Modify: `scripts/validate-preview-acceptance-window.ts`
- Modify: `scripts/prepare-preview-acceptance-deploy-config.ts`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `.github/workflows/preview.yml`
- Test: `tests/unit/domain/temporary-preview-fault.test.ts`
- Test: `tests/unit/scripts/preview-acceptance-window.test.ts`
- Test: `tests/unit/server/wrangler-routing.test.ts`
- Test: `tests/unit/ci/workflows.test.ts`
- Test: `tests/integration/jobs/temporary-preview-fault.test.ts`
- Modify matching simple and technical reference pages.

**Interfaces:**

- Produces:

  ```ts
  export type TemporaryPreviewAcceptanceSelector =
    | TemporaryPreviewFaultScenario
    | "foundation_probe"
    | "ai_usage"
    | "sync_suppression";

  export function previewAcceptanceMaxLifetimeMinutes(
    selector: TemporaryPreviewAcceptanceSelector,
  ): 10 | 30;

  export function createPreviewAcceptanceDeadline(
    activatedAt: Date,
    selector: TemporaryPreviewAcceptanceSelector,
  ): string;

  export function assertPreviewAcceptanceWindow(
    now: Date,
    selector: TemporaryPreviewAcceptanceSelector,
  ): void;

  export function parsePreviewAcceptanceContext(
    operation: PreviewAcceptanceOperation,
    serialized: string,
  ): PreviewAcceptanceWorkflowSelection;
  ```

- Consumers: Tasks 2, 3, and 5 use the admitted selector, expiry, and
  selector-specific lifetime.

- [ ] **Step 1: Write RED selector and lifetime tests**

  Add tests proving:

  ```ts
  expect(TEMPORARY_PREVIEW_FAULT_SCENARIOS).not.toContain("sync_suppression");
  expect(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS).toContain("sync_suppression");
  expect(previewAcceptanceMaxLifetimeMinutes("sync_suppression")).toBe(10);
  expect(previewAcceptanceMaxLifetimeMinutes("ai_usage")).toBe(30);
  ```

  Cover exact ten-minute acceptance, ten minutes plus one millisecond
  rejection, the existing 30-minute candidates, invalid dates, canonical UTC
  expiry, and whole-lifetime recovery-window overlap.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/unit/domain/temporary-preview-fault.test.ts tests/unit/scripts/preview-acceptance-window.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts
  ```

  Expected RED: `sync_suppression` and the selector-aware lifetime signatures
  do not exist.

- [ ] **Step 3: Implement the canonical selector and lifetime functions**

  Use one selector list from the domain module. The lifetime branch is exact:

  ```ts
  export function previewAcceptanceMaxLifetimeMinutes(
    selector: TemporaryPreviewAcceptanceSelector,
  ): 10 | 30 {
    return selector === "sync_suppression" ? 10 : 30;
  }
  ```

  Pass the selected lifetime into both construction-time and execution-time
  protected-window checks. Do not weaken the existing daily-recovery interval.

- [ ] **Step 4: Write RED workflow-selection and artifact-shape tests**

  Add `deploy_sync_suppression` to
  `PREVIEW_ACCEPTANCE_OPERATIONS`. Replace the separate `fault_scenario`,
  `authenticated_reads_gate`, `observer_evidence`, `observer_run_id`,
  `candidate_run_ref`, `rollback_run_id`, and `rollback_closure_run_id`
  top-level dispatch inputs with one required `acceptance_context` string.
  Retain only `acceptance_operation`, `acceptance_context`, and
  `configure_ai_budget`, and assert the workflow has exactly three inputs and
  never exceeds GitHub's ten-input limit.

  `acceptance_context` is at most 2,048 ASCII bytes and is canonical JSON for
  one closed discriminated union. Every variant starts with the exact ordered
  keys `version`, `kind`, and `reviewedCommit`; `version` is
  `vision.preview-acceptance-context/v1`, `kind` equals
  `acceptance_operation`, and `reviewedCommit` is the lowercase 40-hex Task 7
  commit. The remaining exact ordered keys are:

  | `kind` | Ordered keys after `reviewedCommit` |
  |---|---|
  | `none` | none |
  | `observe` | `evidenceFamily`, `expectedOutcome`; then `faultScenario` only for `fault_expected` |
  | `deploy_foundation`, `deploy_sync_suppression` | `authenticatedReadsGate`, `candidateRunRef`, `rollbackClosureRunRef`, `observerDispatchStartedAt`, `observerDispatchCompletedAt` |
  | `deploy_fault` | the candidate keys above, then `faultScenario` |
  | `deploy_ai` | the candidate keys above |
  | `rollback` | `candidateRunRef` |
  | `close_rollback` | `candidateRunRef`, `rollbackRunRef`, `authenticatedReadsGate` |
  | `verify_cleanup` | `candidateRunRef`, `rollbackClosureRunRef` |

  In Task 1, `expectedOutcome` is exactly one of
  `foundation_succeeded`, `fault_expected`, `ai_succeeded`, or
  `sync_suppressed`; its family must agree, and only `fault_expected` carries
  the same exact requested `faultScenario`. AI scheduled/expiry fields,
  role/restore variants, and AI/restore gate fields are rejected until their
  owning task atomically extends the exhaustive union and tests. The
  authenticated-read gate is the exact `verified` literal. Timestamps are
  canonical UTC instants. Lifecycle refs are
  `baseline` only in the admitted prior candidate/closure positions or
  positive decimal strings without leading zeroes; action-produced refs never
  accept `baseline`. The binding profile and numeric observer handle are always
  derived from validated state and never accepted in the context.

  Implement one `serializePreviewAcceptanceContext()` that constructs a new
  plain object in the table order and emits ASCII-only, whitespace-free JSON.
  Parsing rejects non-ASCII input, input over 2,048 bytes, duplicate or extra
  keys, wrong key order, wrong presence/absence, invalid grammar, and any input
  not byte-identical to the serializer output. Return a deeply frozen parsed
  value. The workflow reads the string through a step environment variable to
  a fixed command; it never shell-interpolates or echoes the JSON.

  Task 1 implements the in-run side of immutable attribution. Before any
  credentials or provider access, the dispatched workflow requires both
  `github.sha === reviewedCommit` and checkout `HEAD === reviewedCommit`, with
  checkout pinned to that full commit. Task 3 owns the controller-side remote
  tip comparison, observer `head_sha` filter, and branch-movement race tests.

  For `deploy_sync_suppression`, require authenticated reads verified and the
  same baseline-or-closed-rollback lifecycle fields as the other candidates.

  Assert:

  ```ts
  expect(selection).toMatchObject({
    operation: "deploy_sync_suppression",
    selector: "sync_suppression",
  });
  ```

  The generated suppression artifact must contain the exact selector and
  canonical expiry but exactly the two normal schedules. Existing scheduled
  candidates must still contain three schedules.

- [ ] **Step 5: Implement candidate generation and exact validation**

  In `preparePreviewAcceptanceDeployConfig()`, construct schedules as:

  ```ts
  const candidateCrons =
    input.selector === "sync_suppression"
      ? normalCrons
      : [...normalCrons, ACCEPTANCE_CRON];
  ```

  In `validatePreviewAcceptanceDeployConfig()`, derive the expected schedule
  set from the selector. Reject extra or missing variables, multiple selectors,
  a one-minute suppression schedule, a normal artifact with temporary
  bindings, or any temporary selector in production validation.

- [ ] **Step 6: Integrate the workflow operation**

  Add the exact dispatch option, input validation, and candidate admission.
  Pass the selected operation into both pre-build and pre-deploy lifetime
  checks. Task 3 exclusively owns observer-family mapping. Do not add a
  deployment secret or a committed temporary binding. All later tasks extend
  the one canonical `acceptance_context` union rather than adding top-level
  workflow inputs.

- [ ] **Step 7: Run GREEN verification**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/unit/domain/temporary-preview-fault.test.ts tests/unit/scripts/preview-acceptance-window.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts
  pnpm.cmd exec vitest run --project unit tests/integration/jobs/temporary-preview-fault.test.ts
  pnpm.cmd typecheck
  pnpm.cmd docs:check
  ```

  Expected GREEN: all commands exit zero and normal preview/production retain
  exactly two schedules.

- [ ] **Step 8: Review and commit**

  Require zero Critical and zero Important findings for selector separation,
  recovery-window arithmetic, exact variable/schedule shape, and production
  rejection.

  Stage only this task's literal source/test/workflow paths plus the
  deterministic simple/technical references for its changed source modules.
  Leave setback or unrelated working-tree changes unstaged:

  ```powershell
  $task1ReferenceSources = @(
    'src/domain/operations/temporary-preview-fault.ts',
    'src/server/env.ts',
    'src/server/client-binding-boundary.ts',
    'scripts/validate-preview-acceptance-window.ts',
    'scripts/prepare-preview-acceptance-deploy-config.ts',
    'scripts/validate-preview-deploy-config.ts'
  )
  $task1Paths = @(
    $task1ReferenceSources
    '.github/workflows/preview.yml'
    'tests/unit/domain/temporary-preview-fault.test.ts'
    'tests/unit/scripts/preview-acceptance-window.test.ts'
    'tests/unit/server/wrangler-routing.test.ts'
    'tests/unit/ci/workflows.test.ts'
    'tests/integration/jobs/temporary-preview-fault.test.ts'
    foreach ($source in $task1ReferenceSources) {
      "docs/reference/simple/$($source -replace '\.ts$','.md')"
      "docs/reference/technical/$($source -replace '\.ts$','.md')"
    }
  )
  git add -- $task1Paths
  $unexpected = @(git diff --cached --name-only | Where-Object { $_ -notin $task1Paths })
  $unstaged = @(git diff --name-only -- $task1Paths)
  if ($unexpected.Count -ne 0 -or $unstaged.Count -ne 0) {
    throw 'Task 1 exact staging mismatch'
  }
  git diff --cached --check
  git commit -m "feat: add bounded sync suppression candidate"
  ```

---

## Task 2: Suppress One Fully Verified Notification Without Queue Mutation

**Files:**

- Create: `src/server/webhooks/temporary-preview-sync-suppression.ts`
- Modify: `src/data/repositories/job-repository.ts`
- Modify: `src/server/webhooks/google-calendar.ts`
- Test: `tests/unit/server/temporary-preview-sync-suppression.test.ts`
- Test: `tests/worker/google-webhook.test.ts`
- Test: `tests/integration/jobs/queue-deduplication.test.ts`
- Create:
  `docs/reference/simple/src/server/webhooks/temporary-preview-sync-suppression.md`
- Create:
  `docs/reference/technical/src/server/webhooks/temporary-preview-sync-suppression.md`
- Modify the existing webhook and job-repository reference pages.

**Interfaces:**

- Produces:

  ```ts
  export type TemporarySyncSuppressionState =
    | "inactive"
    | "active"
    | "expired";

  export interface TemporarySyncSuppressionEvidence {
    readonly evidenceType: "vision.sync-suppression/v1";
    readonly outcome: "suppressed";
  }

  export interface TemporarySyncSuppressionEntry {
    readonly action: "acceptance.sync-suppression";
    readonly evidence: TemporarySyncSuppressionEvidence;
  }

  export function resolveTemporarySyncSuppressionState(
    now: Date,
    environment: unknown,
  ): TemporarySyncSuppressionState;

  export function emitTemporarySyncSuppressionEvidence(
    write?: (entry: TemporarySyncSuppressionEntry) => void,
  ): void;
  ```

  ```ts
  interface CalendarJobRepository {
    inspectWebhookReplay(
      message: CalendarSyncMessage,
    ): Promise<"new" | "replay">;
  }
  ```

- Consumes: Task 1's selector and execution-time lifetime parser.
- Produces for Task 3: the exact action/evidence identity observed by the safe
  tail.

- [ ] **Step 1: Write RED pure-producer tests**

  Test inactive, active, expired, malformed, non-preview, and wrong-selector
  environments. Require exact own keys and the two fixed evidence fields.

- [ ] **Step 2: Write RED replay-inspection tests**

  Extend the PGlite-backed queue deduplication suite. A missing `job_id` returns
  `"new"`, an exact owner/provider/calendar/reason match returns `"replay"`,
  and any identity collision, including a cross-provider collision, throws one
  constant safe error. The provider discriminator is the same fixed value used
  by the existing reservation path. The query is read-only and returns no
  provider data.

- [ ] **Step 3: Write RED Worker tests at the exact seam**

  Cover:

  - valid active-channel `exists` plus active suppression emits one record and
    performs zero reserve, Queue-send, and mark-enqueued calls;
  - malformed headers, wrong token/channel/resource, expired channel, pending
    non-`sync`, `sync`, and `not_exists` never emit suppression;
  - a durable replay does not emit;
  - an expired valid selector follows the normal durable path;
  - malformed temporary binding fails closed;
  - a request that crosses expiry during channel/replay I/O follows the normal
    durable path because the suppression decision uses a fresh clock read;
  - duplicate concurrent new reads may produce duplicate records, and the test
    names this as an inconclusive acceptance outcome rather than at-most-once
    behavior;
  - suppression evidence and all newly introduced fields contain no headers,
    event content, channel/resource/message identifiers, or request body; the
    unchanged normal Queue payload retains only its pre-existing bounded
    owner/calendar routing fields.

- [ ] **Step 4: Run tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/unit/server/temporary-preview-sync-suppression.test.ts
  pnpm.cmd exec vitest run --project worker tests/worker/google-webhook.test.ts
  pnpm.cmd exec vitest run --project unit tests/integration/jobs/queue-deduplication.test.ts
  ```

  Expected RED: the new module and replay inspection do not exist.

- [ ] **Step 5: Implement the replay query and suppression producer**

  `inspectWebhookReplay()` performs one parameterized lookup by opaque
  `job_id`. It returns only the closed state after validating exact
  owner/provider/calendar/reason equality. It never reserves or updates a row.

  The producer freezes:

  ```ts
  Object.freeze({
    action: "acceptance.sync-suppression",
    evidence: Object.freeze({
      evidenceType: "vision.sync-suppression/v1",
      outcome: "suppressed",
    }),
  });
  ```

- [ ] **Step 6: Insert the webhook seam**

  Preserve this order:

  ```text
  parse bounded headers
  -> load channel by token hash
  -> constant-time token decision
  -> channel expiry/lifecycle/resource checks
  -> reject not_exists
  -> derive stable opaque message
  -> inspect durable replay
  -> read a fresh execution-time clock
  -> if verified exists + active selector + new: emit and return 204
  -> otherwise reserve, Queue-send, and mark enqueued normally
  ```

  Resolve the selector against that fresh execution-time clock so a request
  that began before expiry but reaches the decision after expiry cannot
  suppress. Do not parse the request body. Do not suppress `sync`. Do not
  reserve a durable job in the active suppression branch. Keep
  `src/worker.ts` and its production dependency factory unchanged; the
  fixed-shape producer owns its optional test writer and the live path uses its
  safe default writer.

- [ ] **Step 7: Run GREEN verification**

  Run the three focused commands from Step 4, then:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  ```

  Expected GREEN: all commands exit zero; existing normal webhook tests remain
  unchanged in meaning.

- [ ] **Step 8: Review and commit**

  Require independent review of authentication ordering, replay-query
  read-only behavior, race wording, evidence shape, and zero durable mutation.

  Stage only this task's literal source/test paths and deterministic
  simple/technical references:

  ```powershell
  $task2ReferenceSources = @(
    'src/server/webhooks/temporary-preview-sync-suppression.ts',
    'src/data/repositories/job-repository.ts',
    'src/server/webhooks/google-calendar.ts'
  )
  $task2Paths = @(
    $task2ReferenceSources
    'tests/unit/server/temporary-preview-sync-suppression.test.ts'
    'tests/worker/google-webhook.test.ts'
    'tests/integration/jobs/queue-deduplication.test.ts'
    foreach ($source in $task2ReferenceSources) {
      "docs/reference/simple/$($source -replace '\.ts$','.md')"
      "docs/reference/technical/$($source -replace '\.ts$','.md')"
    }
  )
  git add -- $task2Paths
  $unexpected = @(git diff --cached --name-only | Where-Object { $_ -notin $task2Paths })
  $unstaged = @(git diff --name-only -- $task2Paths)
  if ($unexpected.Count -ne 0 -or $unstaged.Count -ne 0) {
    throw 'Task 2 exact staging mismatch'
  }
  git diff --cached --check
  git commit -m "feat: add verified notification suppression seam"
  ```

---

## Task 3: Add Closed Observation, Timing Validation, and In-Memory Control

**Files:**

- Create: `scripts/validate-preview-sync-acceptance.ts`
- Create: `scripts/resolve-preview-observer-run.ts`
- Create: `scripts/run-preview-acceptance-controller.ts`
- Create: `src/data/backup/r2-backup-object-reader.ts`
- Create: `src/jobs/temporary-preview-restore-production.ts`
- Modify: `src/jobs/create-daily-backup.ts`
- Modify: `src/jobs/calendar-maintenance-evidence.ts`
- Modify: `src/jobs/temporary-preview-restore.ts`
- Modify: `src/domain/operations/temporary-preview-fault.ts`
- Modify: `src/server/env.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `docs/operations/secrets.md`
- Modify: `scripts/prepare-preview-acceptance-deploy-config.ts`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `scripts/validate-preview-rollback-lifecycle.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `scripts/validate-preview-observer-state.ts`
- Modify: `.github/workflows/preview.yml`
- Test: `tests/unit/scripts/preview-sync-acceptance.test.ts`
- Test: `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- Test: `tests/unit/scripts/preview-acceptance-controller.test.ts`
- Test: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Test: `tests/unit/scripts/print-safe-tail.test.ts`
- Test: `tests/unit/scripts/preview-observer-state.test.ts`
- Test: `tests/unit/ci/workflows.test.ts`
- Test: `tests/unit/domain/temporary-preview-fault.test.ts`
- Test: `tests/unit/scripts/production-deploy-config.test.ts`
- Test: `tests/unit/scripts/preview-rollback-lifecycle.test.ts`
- Test: `tests/unit/server/env.test.ts`
- Test: `tests/unit/server/wrangler-routing.test.ts`
- Test: `tests/security/secret-bundle.test.ts`
- Test: `tests/integration/jobs/daily-backup.test.ts`
- Test: `tests/unit/jobs/calendar-maintenance-evidence.test.ts`
- Test: `tests/integration/jobs/temporary-preview-acceptance-routing.test.ts`
- Test: `tests/integration/jobs/temporary-preview-role-probe.test.ts`
- Test: `tests/integration/jobs/temporary-preview-restore.test.ts`
- Test: `tests/integration/backup/r2-backup-object-reader.test.ts`
- Create or modify matching simple and technical reference pages for every new
  or changed production source/export.

**Interfaces:**

- Produces:

  ```ts
  export function assertSyncSuppressionMargin(
    now: Date,
    expiresAt: string,
    stage: "before_approval" | "before_edit",
  ): void;

  export function validateNormalSyncObservation(input: {
    readonly providerCompletedAt: Date;
    readonly visibleAt: Date;
    readonly nextMaintenanceTick: Date;
    readonly retryCountDelta: number;
    readonly failureCountDelta: number;
  }): { readonly elapsedMilliseconds: number };

  export function firstEligibleRepairTick(
    lastSuccessfulSyncAt: Date,
  ): Date;

  export function validateRepairObservation(input: {
    readonly anchor: Date;
    readonly observedTick: Date;
    readonly repairOutcome: "reserved" | "no_work" | "failed";
    readonly visibleAt: Date;
    readonly retryCountDelta: number;
    readonly failureCountDelta: number;
  }): void;
  ```

  ```ts
  declare const observerHandleBrand: unique symbol;
  export type PreviewObserverRunHandle = string & {
    readonly [observerHandleBrand]: true;
  };

  export async function resolvePreviewObserverRun(
    input: PreviewObserverResolutionInput,
    dependencies: PreviewObserverResolutionDependencies,
  ): Promise<PreviewObserverRunHandle>;

  export type PreviewTwoJobObserverFamily =
    | "sync_suppression"
    | "restore";

  export type PreviewSignalObserverFamily =
    | TemporaryPreviewFaultScenario
    | "foundation_probe"
    | "role_probe";

  export interface PreviewTwoJobObserverState {
    readonly signal: "listening" | "succeeded" | "failed";
    readonly uniqueness: "listening" | "succeeded" | "failed";
    readonly signalObservedAt: Date | null;
  }

  export interface PreviewSignalObserverState {
    readonly signal: "listening" | "succeeded" | "failed";
    readonly signalObservedAt: Date | null;
  }

  export interface CalendarMaintenanceEvidence {
    readonly evidenceType: "vision.calendar-maintenance/v2";
    readonly maintenanceScheduledAt: string;
    readonly outcome: "succeeded" | "failed";
    readonly category:
      | "none"
      | "repair_failed"
      | "renewal_failed"
      | "repair_and_renewal_failed";
    readonly repairOutcome: "reserved" | "no_work" | "failed";
    readonly renewalOutcome: "completed" | "no_work" | "failed";
  }

  export interface PreviewMaintenanceObserverState {
    readonly uniqueness: "listening" | "succeeded" | "failed";
    readonly maintenanceScheduledAt: Date;
  }

  export async function readPreviewTwoJobObserverState(
    handle: PreviewObserverRunHandle,
    family: PreviewTwoJobObserverFamily,
    dependencies: PreviewObserverResolutionDependencies,
  ): Promise<PreviewTwoJobObserverState>;

  export async function readPreviewSignalObserverState(
    handle: PreviewObserverRunHandle,
    family: PreviewSignalObserverFamily,
    dependencies: PreviewObserverResolutionDependencies,
  ): Promise<PreviewSignalObserverState>;

  export async function readPreviewMaintenanceObserverState(
    handle: PreviewObserverRunHandle,
    family: "calendar_maintenance",
    maintenanceScheduledAt: Date,
    dependencies: PreviewObserverResolutionDependencies,
  ): Promise<PreviewMaintenanceObserverState>;
  ```

  ```ts
  export type TemporaryPreviewAcceptanceSelector =
    | TemporaryPreviewFaultScenario
    | "foundation_probe"
    | "ai_usage"
    | "sync_suppression"
    | "role_probe"
    | "restore";

  export type PreviewObserverAcceptanceExpectation =
    | { readonly kind: "sync_suppressed" }
    | { readonly kind: "foundation_succeeded" }
    | {
        readonly kind: "fault_expected";
        readonly scenario: TemporaryPreviewFaultScenario;
      }
    | { readonly kind: "role_probe_succeeded" }
    | { readonly kind: "restore_succeeded" }
    | {
        readonly kind: "maintenance_succeeded";
        readonly maintenanceScheduledAt: string;
      }
    | {
        readonly kind: "maintenance_repair_reserved";
        readonly maintenanceScheduledAt: string;
      }
    | { readonly kind: "ai_succeeded" };

  export function matchesPreviewAcceptanceExpectation(
    evidence: SafeTailResult,
    expectation: PreviewObserverAcceptanceExpectation,
  ): boolean;

  export type PreviewRestoreAdmissionGate = "verified";

  export function validateTemporaryRestorePairProviderState(
    input: NormalPreviewProviderState,
  ): void;

  export interface BackupObjectCatalogReader extends BackupObjectReader {
    list(
      prefix: string,
      cursor?: string,
    ): Promise<{
      readonly objects: readonly BackupObjectHead[];
      readonly cursor?: string;
    }>;
  }

  export function createR2BackupObjectCatalogReader(
    bucket: Pick<R2Bucket, "head" | "get" | "list">,
  ): BackupObjectCatalogReader;

  export interface TemporaryPreviewRestoreRuntimeInput {
    readonly VISION_ENV: "preview";
    readonly PREVIEW_RESTORE_DATABASE_URL: string;
    readonly PREVIEW_RESTORE_TARGET_ID: string;
    readonly BACKUP_ENCRYPTION_KEY: string;
    readonly BACKUP_KEY_VERSION: string;
    readonly catalogReader: BackupObjectCatalogReader;
    readonly attemptFence: Pick<RestoreAttemptStore, "claimOnce">;
  }

  export async function runProductionTemporaryPreviewRestore(
    input: TemporaryPreviewRestoreRuntimeInput,
  ): Promise<TemporaryRestoreEvidence>;
  ```

- Consumes: Task 2's suppression evidence.
- Produces for live execution: safe elapsed milliseconds, eligible tick, a
  closed observer-dispatch UTC interval, and an opaque run handle retained only
  inside the controller process.

- [ ] **Step 1: Write RED exact-evidence classifier tests**

  Add `vision.sync-suppression/v1` and
  `acceptance.sync-suppression` as one terminal identity. Require exact keys,
  reject extra keys, mixed terminal families, hostile accessors, and raw-line
  retention. Add `--sync-suppression-only` as one mutually exclusive printer
  mode. In that mode, retain the first safe terminal, continue through the
  complete 120-second uniqueness window, fail on a second or mixed terminal,
  and print the first only when the window closes with exactly one.

  Add a separate temporary `--sync-suppression-signal-only` mode for a second
  tail job in the same observer run. It exits zero immediately after the first
  exact suppression terminal and otherwise emits nothing. The controller never
  reads its logs; it observes only the fixed job name, closed success/failure
  state, and UTC completion timestamp through allowlisted Actions metadata.
  Clocked tests cover early/late first records and prove neither mode returns an
  identifier or raw input.

  Every observer receives one closed
  `PreviewObserverAcceptanceExpectation` derived from the canonical observe
  context. Classification alone is not success. Foundation, role probe,
  restore, and AI require `outcome=succeeded` and their exact success
  categories/invariants. Maintenance baseline requires a succeeded
  non-failure pair; the repair observation additionally requires
  `repairOutcome=reserved`. A fault requires the exact requested scenario and
  the deterministic state returned by
  `createTemporaryPreviewFaultEvidence()`—including the intentional
  `r2_upload_failed` failure/category pair. Suppression requires only its exact
  `suppressed` shape. A canonical failure, wrong scenario, wrong maintenance
  outcome, or otherwise valid but non-accepting terminal makes both signal and
  uniqueness acceptance exit nonzero.

  Apply the same two-job pattern only to the replay-fenced restore family:
  `--restore-only` becomes a 120-second uniqueness closer and the temporary
  `--restore-signal-only` mode exits zero without output on the first exact
  terminal. Preserve the existing first-terminal
  `--foundation-probe-only`, `--preview-fault-only`, and
  `--role-probe-only` modes as their sole signal jobs. Those one-minute
  candidates are not single-eligible and can still be deployed while rollback
  is rebuilding, so a 120-second uniqueness requirement would reject a
  legitimate second scheduled delivery.

  Every signal or signal-only mode exits nonzero on end-of-stream without a
  match, malformed or mixed input, or upstream tail failure. Signal-only modes
  emit no protected or raw input; the retained first-terminal modes emit only
  their existing fixed safe terminal. Job success is the signal, and an empty
  successful job is forbidden. Clocked and subprocess tests cover every
  success and failure exit path.

  Upgrade permanent maintenance evidence to the exact six-key
  `vision.calendar-maintenance/v2` shape above. Its
  `maintenanceScheduledAt` is canonical UTC derived inside the Worker from the
  already-admitted `ScheduledController.scheduledTime` passed into
  `runScheduledCalendarMaintenance()`; it is not inferred from log arrival time
  or an unvalidated tail envelope. Update the evidence factory, classifier,
  printer, integration seam, references, and exact-key tests atomically. V1 or
  a missing, extra, malformed, or noncanonical timestamp fails closed.

  Give the existing `--calendar-maintenance-only` mode the same bounded
  uniqueness close around one canonical `maintenanceScheduledAt` target tick.
  Require every accepted maintenance terminal to carry that exact scheduled
  event instant, retain the first matching terminal through
  `maintenanceScheduledAt + 120 seconds`, reject a second or mixed terminal,
  and finalize only after that fixed window. Reject earlier, later, or
  timestamp-missing maintenance events rather than allowing a delayed prior
  invocation to satisfy the target observer. This window closes before the
  next legitimate quarter-hour tick. Every uniqueness closer, including
  suppression, restore, and maintenance here and AI in Task 5, succeeds only
  when exactly one terminal survives the true close. Zero terminals, malformed
  or mixed input, premature stdin or `wrangler tail` end-of-stream, and
  upstream failure exit nonzero without a fallback success record.

- [ ] **Step 2: Write RED timing tests**

  Test five minutes exactly, five minutes minus one millisecond, four minutes
  exactly, and four minutes minus one millisecond. Test normal visibility at
  zero, 120 seconds, and 120 seconds plus one millisecond. Test the first
  quarter-hour tick where:

  ```text
  lastSuccessfulSyncAt <= eligibleTick - 15 minutes
  ```

  Verify just-before-boundary rejection, exact-boundary acceptance, anchor
  change recomputation, repair `reserved`, following-tick visibility, and exact
  zero retry/failure counter deltas for both normal and repair observations.
  For maintenance observation, accept only the exact canonical scheduled-event
  instant, close at that instant plus exactly 120 seconds, and reject earlier,
  later, missing, malformed, or lower-precision scheduled timestamps.

- [ ] **Step 3: Write RED bounded resolver tests**

  Use an injected monotonic clock and sleep function. Poll every five seconds
  through a 120-second deadline. Filter only the expected workflow,
  `workflow_dispatch` event, immutable full commit, and closed dispatch
  interval. Suppression and replay-fenced restore observers require exactly one
  signal job and one uniqueness job. Foundation, fault, and role-probe
  observers require exactly their one first-terminal signal job. Permanent
  maintenance requires exactly one uniqueness job and rejects any signal or
  extra job. Its observer context and printer arguments carry the same
  canonical `maintenanceScheduledAt`. Require one allowlisted listener step
  active in every expected job before candidate deployment or that exact
  maintenance target tick.
  Reject zero final matches, multiple matches at any poll, late
  duplicate appearance, malformed metadata, wrong commit/event/workflow,
  inactive jobs, missing or duplicate listener steps, non-positive/non-decimal
  run identifiers, and timeout. Validate a positive decimal identifier before
  branding it as `PreviewObserverRunHandle`.

  The resolver returns the branded handle but has no printing or serialization
  function. `readPreviewTwoJobObserverState()` and
  `readPreviewSignalObserverState()` validate their exact family/job mapping
  and the one allowlisted signal-listener step. They report signal success only
  when both that step and its containing job succeeded, and use the listener
  step's `completed_at` as `signalObservedAt`; later job post-steps cannot
  extend the rollback clock. Reject missing, ambiguous, malformed, future, or
  lower-precision timestamps that cannot be bounded. Tests model the
  provider's one-second timestamp precision and require a conservative deadline
  that still proves rollback within 60 real seconds.
  `readPreviewMaintenanceObserverState()` validates the exact maintenance
  uniqueness job, its sole listener, and equality with the caller's canonical
  `maintenanceScheduledAt`. It reports success only after the true close at
  `maintenanceScheduledAt + 120 seconds` and rejects earlier, later, or
  timestamp-missing events plus zero, duplicate, mixed, malformed,
  premature-EOF, failed, signal-job, or extra-job states.

- [ ] **Step 4: Write RED current-workflow role/restore tests**

  Add `role_probe` and `restore` as dedicated selectors outside the six-fault
  tuple, plus closed `deploy_role_probe` and `deploy_restore` operations in the
  reviewed current preview workflow. Both use the same observer-first resolver,
  independent candidate-side re-resolution, immutable `github.sha`,
  rollback/closure gates, and exact artifact validation as every current
  candidate.

  Atomically in the same RED/GREEN cycle, extend Task 1's canonical context
  parser, serializer, ordered-key table, and exhaustive rejection tests. Add
  `deploy_role_probe` with the existing candidate base keys. Add
  `deploy_restore` with those base keys followed only by
  `restoreAdmissionGate`. Extend observe expectations with
  `role_probe_succeeded`, `restore_succeeded`, `maintenance_succeeded`, and
  `maintenance_repair_reserved`. Only the two maintenance expectations require
  canonical `maintenanceScheduledAt` immediately after `expectedOutcome`; all
  other observe variants reject that key. Extend the canonical serializer,
  ordered-key table, workflow inputs, and exhaustive missing/extra/wrong-order
  rejection tests in the same atomic change. Before this extension, every new
  operation, expectation, restore gate, and maintenance timestamp remains
  rejected.

  Preserve `validateNormalPreviewProviderState()` unchanged as the strict
  exact-normal contract for baseline, every non-role/restore candidate, final
  cleanup, and permanent use. Add a separate
  `validateTemporaryRestorePairProviderState()` used only by
  `deploy_role_probe`, `deploy_restore`, and their derived rollback/closure
  lifecycle. It requires healthy runtime, exactly the two normal schedules,
  every exact normal binding, and exactly two additional `secret_text`
  bindings named `PREVIEW_RESTORE_DATABASE_URL` and
  `PREVIEW_RESTORE_TARGET_ID`. It rejects a missing, duplicate, wrong-type, or
  extra binding and never reads a value-bearing property from either temporary
  secret entry.

  Expose that validator only as the closed
  `--verify-restore-pair-provider-state` CLI mode taking the same three
  response-file paths as strict normal verification. The workflow selects it
  only after deriving `restore_pair` from the validated role/restore operation
  or lifecycle artifact; all other branches continue calling
  `--verify-provider-state`. No caller can supply a binding profile string.

  Derive a fixed `normal` or `restore_pair` binding profile from the validated
  operation and write it into the privacy-safe candidate intent; never accept
  that profile as a caller-selected workflow input. Candidate predeploy,
  rollback, and closure re-derive and enforce the same profile from the signed
  lifecycle artifacts. A role-probe `restore_pair` closure may unlock only the
  immediately following `deploy_restore` operation at the same immutable
  commit. A restore `restore_pair` closure may unlock only temporary-secret
  cleanup. It cannot unlock foundation, fault, suppression, AI, or source
  cleanup.

  After the ordered pair, extend the existing `verify_cleanup` operation to
  require both approved temporary names absent and rerun the unchanged strict
  normal provider-state validator. Its fixed-shape cleanup proof returns the
  lifecycle to `normal`; no later candidate or Task 9 may start without that
  proof. Tests cover predeploy, rollback, closure, the role-to-restore handoff,
  post-restore deletion/absence, and rejection of every cross-profile
  transition. Extend `validate-preview-rollback-lifecycle.ts` and its focused
  tests so the lifecycle artifact derives the binding profile rather than
  accepting one from the caller. Cover same-commit role closure to restore,
  role closure to cleanup-only, restore closure to cleanup-only, cleanup proof
  back to strict `normal`, and rejection of every cross-profile or
  cross-commit transition.

  The `deploy_restore` context alone requires
  `restoreAdmissionGate=verified`; every other context omits the key. The
  attestation means the disposable target/marker checks and single-attempt
  authorization were completed privately and is never a Worker binding. Role
  probe may construct only its existing read-only adapter.
  Restore may construct only the existing fenced restore dependencies after
  that gate is verified; it keeps the replay
  marker and existing non-retry contract. Test that missing temporary restore
  secret names fail closed without reading values, and that neither operation
  can run from the historical workflow shape or bypass the current observer.
  Narrow the role-probe integration test's former whole-file prohibition on
  the restore target binding/module to the role-probe selector branch: the new
  exact `restore` branch may reference them, while the `role_probe` branch must
  still construct only its database-role probe.

  Split `BackupObjectCatalogReader` from the delete-capable
  `BackupObjectStore`, change `TemporaryPreviewRestoreDependencies.store` to the
  reader type, and test a dedicated R2 adapter with only `head`, `get`, and
  `list`. After all selector, observer, attestation, and cron gates,
  `scheduled.ts` snapshots only the exact scalar fields above, constructs the
  catalog reader from a read-only bucket pick, and passes only the pre-existing
  replay-fence `claimOnce` capability under its fixed marker prefix. Structural
  tests reject broad `Env`, a raw `R2Bucket`, backup-object `putIfAbsent`,
  `delete`, the production delete-capable factory, or any other write-capable
  object crossing the backup catalog/read path. The sole permitted write
  capability is the existing replay-fence `claimOnce`; no restore retry is
  added.

- [ ] **Step 5: Write RED controller orchestration tests**

  In `tests/unit/scripts/preview-acceptance-controller.test.ts`, use injected
  wall and monotonic clocks plus argument-array child-process adapters. Cover:

  - the opaque-handle boundary and absence of a numeric observer handle from
    every dispatch input;
  - `assertSyncSuppressionMargin(now, expiresAt, "before_approval")`
    immediately before requesting suppression approval, accepting exactly five
    minutes and rejecting five minutes minus one millisecond;
  - `assertSyncSuppressionMargin(now, expiresAt, "before_edit")` immediately
    before the provider edit, accepting exactly four minutes and rejecting four
    minutes minus one millisecond;
  - a slow approval that remains valid at both gates, and rollback without an
    edit when either gate fails;
  - immediate signal-job completion versus delayed uniqueness close,
    five-second polling, rollback within both the 50-monotonic-second and
    59-provider-timestamp-second bounds, and one-job versus two-job families;
  - the 60-second approval expiry, pre-action idle rollback, the
    action-completion-anchored no-signal deadline, rollback on every
    child/observer/action error, and branch movement before any dispatch; and
  - exact stdout/stderr privacy with neither ref value, run handle, provider
    response, command argument, nor protected value emitted.

  These tests must exist and fail for missing controller behavior before any
  controller implementation begins. The generic `expiresAt - 180 seconds`
  idle gate does not replace either suppression-specific margin call.

- [ ] **Step 6: Run tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/unit/scripts/preview-sync-acceptance.test.ts tests/unit/scripts/preview-observer-run-resolution.test.ts tests/unit/scripts/preview-acceptance-controller.test.ts tests/unit/scripts/preview-rollback-lifecycle.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/unit/scripts/preview-observer-state.test.ts tests/unit/scripts/production-deploy-config.test.ts tests/unit/jobs/calendar-maintenance-evidence.test.ts tests/unit/domain/temporary-preview-fault.test.ts tests/unit/server/env.test.ts tests/unit/server/wrangler-routing.test.ts tests/security/secret-bundle.test.ts tests/integration/backup/r2-backup-object-reader.test.ts tests/integration/jobs/daily-backup.test.ts tests/integration/jobs/temporary-preview-acceptance-routing.test.ts tests/integration/jobs/temporary-preview-role-probe.test.ts tests/integration/jobs/temporary-preview-restore.test.ts tests/unit/ci/workflows.test.ts
  ```

  Expected RED: new exports, maintenance v2 scheduled-instant field, evidence
  family, observer modes, current-workflow role/restore operations, production
  restore adapter, and controller are absent.

- [ ] **Step 7: Implement the pure classifiers and validators**

  Reconstruct evidence only from fixed constants. The sync timing validator
  returns only a bounded elapsed integer or throws a constant safe error.
  Apply `matchesPreviewAcceptanceExpectation()` after structural
  classification in every observer mode; never let a canonical but
  acceptance-failing terminal produce a successful observer job.

- [ ] **Step 8: Implement bounded observer resolution**

  The injected provider adapter returns only allowlisted metadata fields. The
  resolver snapshots own enumerable scalar data, enforces a response-size
  bound, and never prints raw responses. Multiple matching runs fail
  immediately; zero matches continue until the monotonic deadline.

- [ ] **Step 9: Implement the controller**

  `run-preview-acceptance-controller.ts` uses argument-array subprocess calls,
  never shell interpolation. It pipes or discards child stderr rather than
  inheriting it. It captures dispatch start/end UTC timestamps, resolves the
  observer, and validates it. The candidate context carries observer identity
  only as the safe closed dispatch interval; it never receives the numeric
  handle. Its stdout vocabulary is limited to:

  ```ts
  type ControllerStatus =
    | "observer_ready"
    | "candidate_dispatched"
    | "candidate_signal_seen"
    | "rollback_dispatched"
    | "closure_verified"
    | "failed_closed";
  ```

  `gh workflow run --ref` cannot accept a raw commit. The controller therefore
  uses only the allowlisted reviewed branch
  `codex/phase-b-foundation`, resolves its remote tip immediately before every
  observer, candidate, rollback, closure, and cleanup dispatch, and compares it
  in memory with the exact Task 7 `reviewedCommit` carried inside canonical
  context. Only a boolean equality result may be emitted. Any movement fails
  closed; the in-run workflow still requires run `head_sha`, `github.sha`, and
  checkout equality with that same value before credentials or provider
  access.

  After the disposable action, the controller polls the family-appropriate
  `readPreviewTwoJobObserverState()` or
  `readPreviewSignalObserverState()` every five seconds for temporary
  candidates. Permanent maintenance uses only
  `readPreviewMaintenanceObserverState()` with the exact canonical
  `maintenanceScheduledAt` selected before observer dispatch and cannot accept
  a signal job, an extra observer job, or a terminal from any other scheduled
  instant. Signal-job success becomes the fixed
  `candidate_signal_seen` status; the controller records the allowlisted
  listener step's safe `signalObservedAt` and its local monotonic detection
  instant, then dispatches normal rollback within 50 monotonic seconds and no
  later than 59 seconds after that provider timestamp. The one-second
  conservative allowance proves the approved 60-real-second bound even if the
  provider rounds its timestamp upward.

  Suppression and restore uniqueness jobs remain active through their true
  120-second close; final acceptance waits for success with exactly one
  terminal. Foundation, fault, and role-probe acceptance ends from their
  first-terminal signal plus verified rollback/closure and intentionally makes
  no duplicate claim. The controller never reads job logs or prints a run
  handle, commit, link, provider response, or command arguments.

  For any user-mediated candidate action, the pre-action idle deadline is
  `expiresAt - 180 seconds`; if approval and action cannot begin before it,
  rollback without acting. After the provider-confirmed action completes, the
  no-signal deadline is
  `min(actionCompletedAt + 120 seconds, expiresAt - 60 seconds)`. For scheduled
  candidates without a separate user action, `actionCompletedAt` is candidate
  deploy completion. Revalidate that the applicable deadline is future
  immediately before acting. If signal success has not been proved at the
  no-signal deadline, dispatch rollback immediately, complete signed-in
  closure, and fail the attempt. For suppression or restore, allow the
  already-running uniqueness job to reach its true close and require its
  expected nonzero zero-terminal result; never leave the candidate deployed
  while waiting. A failed signal, zero/duplicate/mixed uniqueness result,
  child-process error, or uncertain rollback fails closed; fenced restore is
  never retried.

  For `sync_suppression`, call
  `assertSyncSuppressionMargin(now, expiresAt, "before_approval")`
  immediately before requesting approval and call
  `assertSyncSuppressionMargin(now, expiresAt, "before_edit")` immediately
  before the provider edit. The first call enforces at least five minutes and
  the second at least four minutes. Failure at either point dispatches normal
  rollback/closure without editing. The generic pre-action and no-signal
  deadlines remain additional gates and cannot substitute for these calls.
  Make the complete RED matrix from Step 5 pass without weakening a boundary
  assertion.

- [ ] **Step 10: Integrate workflow observer mapping**

  Add `sync_suppression` to the observer input and map
  `deploy_sync_suppression` to it in both pre-build and pre-deploy validation.
  For sync-suppression and replay-fenced restore, run signal and uniqueness
  tail jobs concurrently inside the same observer workflow run. Foundation,
  fault, and role-probe observers run only their exact first-terminal signal
  job. Permanent maintenance runs only its bounded uniqueness job and rejects
  any signal or extra job. After canonical context validation, derive only the
  fixed expectation enum and optional closed fault scenario for each tail job;
  revalidate those values in the printer and never pass lifecycle refs or the
  full context to `wrangler tail`.

  The canonical candidate `acceptance_context` carries only the observer
  dispatch start/end timestamps, never `observer_run_id`. In the candidate
  job, independently call the bounded resolver using that interval, the
  candidate run's immutable `github.sha`, expected
  workflow/event/evidence family, and exact job names;
  keep the resolved number inside that job process and require every expected
  family-specific listener step active. Preserve observer/mutation concurrency
  separation and the existing Actions-read-only permission. A standalone CLI
  that prints a run handle is prohibited.

  Add current-workflow `role_probe`/`restore` observer families. Map role probe
  to its existing first-terminal `--role-probe-only` printer and restore to
  `--restore-signal-only` plus the uniqueness-closing `--restore-only`. Map
  `deploy_role_probe`/`deploy_restore` through the same interval-based resolver
  and candidate gates. Generate exact one-minute candidates with the two normal
  schedules; no secret value enters config or workflow input.

  In `scheduled.ts`, remove the secret-presence role-probe fallback and route
  only exact `role_probe` or `restore` selectors. Lazily build the role-probe or
  `runProductionTemporaryPreviewRestore()` dependencies only after selector,
  lifetime, protected-window, observer, attestation, and cron admission. The
  production restore adapter composes the dedicated read-only R2 catalog
  adapter, backup-key import, replay fence, disposable-target import, and
  readback modules from `TemporaryPreviewRestoreRuntimeInput`; neither its type
  nor constructed backup-reader object exposes a raw bucket, backup-object
  `putIfAbsent`, or `delete`, and it never returns protected values.

- [ ] **Step 11: Run GREEN verification**

  Run the focused command from Step 6, then:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  ```

  Expected GREEN: all commands exit zero and tests prove both sync and
  maintenance uniqueness windows, the two-job suppression signal protocol,
  rollback dispatch within both deadlines for early and late suppression
  records, current-workflow-only role/restore admission with a read-only R2
  dependency graph, zero job-log reads, and zero raw observer identifiers or
  child command arguments reaching stdout or stderr.

- [ ] **Step 12: Review and commit**

  Require independent privacy, timing-boundary, workflow, and subprocess review
  with zero Critical and zero Important findings.

  Stage only this task's literal source/test/workflow/operations paths and
  deterministic simple/technical references:

  ```powershell
  $task3ReferenceSources = @(
    'scripts/validate-preview-sync-acceptance.ts',
    'scripts/resolve-preview-observer-run.ts',
    'scripts/run-preview-acceptance-controller.ts',
    'scripts/prepare-preview-acceptance-deploy-config.ts',
    'scripts/validate-preview-deploy-config.ts',
    'scripts/validate-preview-rollback-lifecycle.ts',
    'scripts/safe-tail-classifier.ts',
    'scripts/print-safe-tail.ts',
    'scripts/validate-preview-observer-state.ts',
    'src/data/backup/r2-backup-object-reader.ts',
    'src/jobs/temporary-preview-restore-production.ts',
    'src/jobs/create-daily-backup.ts',
    'src/jobs/calendar-maintenance-evidence.ts',
    'src/jobs/temporary-preview-restore.ts',
    'src/jobs/scheduled.ts',
    'src/domain/operations/temporary-preview-fault.ts',
    'src/server/env.ts'
  )
  $task3Paths = @(
    $task3ReferenceSources
    '.github/workflows/preview.yml'
    'docs/operations/secrets.md'
    'tests/unit/scripts/preview-sync-acceptance.test.ts'
    'tests/unit/scripts/preview-observer-run-resolution.test.ts'
    'tests/unit/scripts/preview-acceptance-controller.test.ts'
    'tests/unit/scripts/preview-rollback-lifecycle.test.ts'
    'tests/unit/scripts/safe-tail-classifier.test.ts'
    'tests/unit/scripts/print-safe-tail.test.ts'
    'tests/unit/scripts/preview-observer-state.test.ts'
    'tests/unit/scripts/production-deploy-config.test.ts'
    'tests/unit/ci/workflows.test.ts'
    'tests/unit/domain/temporary-preview-fault.test.ts'
    'tests/unit/server/env.test.ts'
    'tests/unit/server/wrangler-routing.test.ts'
    'tests/security/secret-bundle.test.ts'
    'tests/integration/jobs/daily-backup.test.ts'
    'tests/unit/jobs/calendar-maintenance-evidence.test.ts'
    'tests/integration/jobs/temporary-preview-acceptance-routing.test.ts'
    'tests/integration/jobs/temporary-preview-role-probe.test.ts'
    'tests/integration/jobs/temporary-preview-restore.test.ts'
    'tests/integration/backup/r2-backup-object-reader.test.ts'
    foreach ($source in $task3ReferenceSources) {
      "docs/reference/simple/$($source -replace '\.ts$','.md')"
      "docs/reference/technical/$($source -replace '\.ts$','.md')"
    }
  )
  git add -- $task3Paths
  $unexpected = @(git diff --cached --name-only | Where-Object { $_ -notin $task3Paths })
  $unstaged = @(git diff --name-only -- $task3Paths)
  if ($unexpected.Count -ne 0 -or $unstaged.Count -ne 0) {
    throw 'Task 3 exact staging mismatch'
  }
  git diff --cached --check
  git commit -m "feat: add guarded acceptance controller"
  ```

---

## Task 4: Make AI Request Eligibility Reachable and Aggregate-Only

**Files:**

- Modify: `src/domain/operations/temporary-preview-fault.ts`
- Modify: `src/server/env.ts`
- Modify: `src/server/client-binding-boundary.ts`
- Modify: `src/data/phase-b-ai-usage-source.ts`
- Modify: `src/server/api/diagnostic-routes.ts`
- Modify: `scripts/run-preview-acceptance-controller.ts`
- Modify: `scripts/prepare-preview-acceptance-deploy-config.ts`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `.github/workflows/preview.yml`
- Test: `tests/unit/scripts/preview-acceptance-window.test.ts`
- Test: `tests/unit/scripts/preview-acceptance-controller.test.ts`
- Test: `tests/unit/server/wrangler-routing.test.ts`
- Test: `tests/unit/server/env.test.ts`
- Test: `tests/integration/data/phase-b-ai-usage-source.test.ts`
- Test: `tests/integration/jobs/temporary-preview-fault.test.ts`
- Test: `tests/security/secret-bundle.test.ts`
- Test: `tests/e2e/foundation-diagnostics.spec.ts`
- Test: `tests/worker/diagnostics.test.ts`
- Test: `tests/unit/ci/workflows.test.ts`
- Modify matching simple and technical reference pages.

**Interfaces:**

- Produces:

  ```ts
  export interface PreviewAiEvidenceWindow {
    readonly activatedAt: Date;
    readonly evidenceScheduledAt: Date;
    readonly expiresAt: Date;
  }

  export function createPreviewAiEvidenceWindow(
    activatedAt: Date,
  ): PreviewAiEvidenceWindow;

  export function parseTemporaryPreviewAiEvidenceWindow(
    environment: unknown,
  ): PreviewAiEvidenceWindow | undefined;

  export interface PhaseBAiUsageEligibilityWindow {
    readonly activatedAt: Date;
    readonly evidenceScheduledAt: Date;
  }

  export interface PhaseBAiCandidateRequestCounts {
    readonly createdRequestCount: number;
    readonly eligibleSettledRequestCount: number;
  }

  export interface PhaseBAiUsageSource {
    read(budgetMonth: string): Promise<PhaseBAiUsageMeasurements>;
    countActiveRequests(): Promise<number>;
    readCandidateRequestCounts(
      window: PhaseBAiUsageEligibilityWindow,
    ): Promise<PhaseBAiCandidateRequestCounts>;
  }
  ```

  Temporary authenticated preview response:

  ```ts
  aiAcceptance: {
    activeRequestCount: number;
    createdRequestCount: number | null;
    eligibleSettledRequestCount: number | null;
    evidenceScheduledAt: string | null;
  }
  ```

- Consumes: Task 1's selector and fixed candidate-lifetime functions.
- Produces for Task 5: the parsed AI window plus exact active, created, and
  eligible counts.

- [ ] **Step 1: Write RED AI-window and artifact tests**

  Before dispatching the observer, the controller calls
  `createPreviewAiEvidenceWindow()` and places its canonical scheduled instant
  and expiry in the one temporary `acceptance_context` for both the AI observer
  and candidate.
  The generated candidate carries
  `PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT` only with `ai_usage`.
  Derive activation from the fixed 30-minute lifetime and expiry. Require a
  canonical UTC minute and:

  ```text
  activatedAt < evidenceScheduledAt
  evidenceScheduledAt < expiresAt
  expiresAt < evidenceScheduledAt + 60 seconds
  ```

  Require activation and expiry in the same Chicago accounting month. Cover an
  input whose unadjusted expiry lands exactly on a minute boundary. For that
  input only, shift the complete generated AI window forward by one
  millisecond, then set `evidenceScheduledAt` to the UTC-minute floor of the
  adjusted expiry. This preserves an exact 30-minute lifetime and makes the
  strict inequalities constructible. Parser input with unadjusted equality is
  still rejected. Normal, suppression, foundation, and fault artifacts reject
  the AI-only binding. Reject observer/candidate window drift, a window
  activated after observer dispatch, and a candidate whose remaining window is
  below the live request margin. Choose/reject activation so the expiry plus
  the 60-second rollback bound cannot cross a permanent quarter-hour or daily
  schedule instant; test both exact boundary and one-millisecond overlap.

- [ ] **Step 2: Write RED aggregate query tests**

  Test owner-wide active count for only `reserved` and `dispatched`. In one
  candidate-window statement, `createdRequestCount` counts every owner
  reservation created at or after activation and strictly before the evidence
  instant, regardless of whether its lifecycle is `reserved`, `dispatched`,
  `released`, `settled_estimate`, or `settled`.
  `eligibleSettledRequestCount` is the subset dispatched normally, completed
  strictly before the evidence instant, and confirmed in exact production
  status `settled`.

  `countActiveRequests()` is owner-wide across every Chicago accounting month:
  an active reservation in another month still counts and blocks admission.
  Only candidate-window created/eligible aggregates apply the activation,
  completion, and candidate-month boundaries below.

  Exclude a pre-activation or at/after-evidence creation and a foreign owner
  from both counts. Apply completion and status filters only to
  `eligibleSettledRequestCount`; do not filter those rows out of
  `createdRequestCount`. Candidate-month mismatch or inconsistent
  current-row/ledger lifecycle throws the existing safe `inconsistent` failure
  instead of silently excluding the row. Eligibility alone excludes:

  ```text
  completion at the evidence instant
  completion after the evidence instant
  reserved
  dispatched
  released
  settled_estimate
  ```

  Require both `countActiveRequests()` and `readCandidateRequestCounts()` to
  validate ledger consistency and count in one SQL statement snapshot.
  Candidate-window fixtures include the intended settled request plus a second
  released, in-flight, or settled request; all must report
  `createdRequestCount > 1` even when only one row is eligible.

- [ ] **Step 3: Write RED authenticated diagnostics tests**

  In normal preview, authenticated owner diagnostics returns active count and
  null eligible fields. In the AI candidate, it returns both counts and the
  canonical scheduled instant. It returns both created and eligible aggregate
  counts from the same read. Production omits `aiAcceptance`.
  Unauthenticated and wrong-owner requests perform zero aggregate reads.

  Verify no reservation ID, idempotency key, model, provider request identity,
  token count, prompt, response, or row is serialized.

- [ ] **Step 4: Write RED workflow gate tests**

  Add:

  ```ts
  export type PreviewAiZeroActiveGate = "verified";
  ```

  Only the canonical `deploy_ai` context contains `aiZeroActiveGate`, and it
  must equal `verified`. Every other context variant omits the key and rejects
  its presence. The value is an operator attestation derived from the signed-in
  aggregate and is never a Worker binding. AI observe/deploy operations require
  the same controller-generated scheduled instant and expiry; all other
  operation/observer combinations reject those inputs.

  This task atomically extends Task 1's previously gate-free `deploy_ai`
  variant with the ordered suffix `aiZeroActiveGate`,
  `evidenceScheduledAt`, `expiresAt`, and extends only the `ai_succeeded`
  observe form with ordered `evidenceScheduledAt`, `expiresAt`. Update the
  canonical serializer, parser, exact-key table, byte-for-byte
  reserialization, and exhaustive rejection tests in this same task; no earlier
  task accepts these fields.

- [ ] **Step 5: Run tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/unit/scripts/preview-acceptance-window.test.ts tests/unit/scripts/preview-acceptance-controller.test.ts tests/unit/server/env.test.ts tests/unit/server/wrangler-routing.test.ts tests/integration/data/phase-b-ai-usage-source.test.ts tests/integration/jobs/temporary-preview-fault.test.ts tests/security/secret-bundle.test.ts tests/unit/ci/workflows.test.ts
  pnpm.cmd exec vitest run --project worker tests/worker/diagnostics.test.ts
  pnpm.cmd test:e2e -- tests/e2e/foundation-diagnostics.spec.ts
  ```

  Expected RED: the AI window/binding, count methods, temporary diagnostics
  field, and workflow gate do not exist.

- [ ] **Step 6: Implement the AI window and exact artifact contract**

  Generate one canonical evidence minute in the controller before observer
  dispatch from the fixed activation/expiry interval, including the
  one-millisecond exact-boundary adjustment from Step 1. The observer and
  candidate workflows validate exact equality with that window. Add the
  AI-only binding to environment validation, the client-forbidden binding
  inventory, candidate generation, and exact candidate validation.
  `parseTemporaryPreviewAiEvidenceWindow()` snapshots only own scalar values
  and returns frozen `Date` copies.

- [ ] **Step 7: Implement atomic aggregate statements**

  Parameterize owner and times. Use guaranteed-row aggregates and the existing
  safe-integer decoder. Both `countActiveRequests()` and
  `readCandidateRequestCounts()` validate reservation/ledger lifecycle inside
  their own single-statement snapshots. The candidate statement returns both
  created and eligible counts together. `countActiveRequests()` returns one
  validated nonnegative safe integer. `readCandidateRequestCounts()` returns a
  frozen `PhaseBAiCandidateRequestCounts` object whose two properties are
  validated nonnegative safe integers.

- [ ] **Step 8: Add the temporary diagnostics bridge**

  Extend `DiagnosticRouteDependencies` with an owner-bound factory exposing
  only the two count methods. Authenticate and bind the owner before
  constructing it. Add the response only when `VISION_ENV === "preview"`.
  Outside the AI selector, do not run eligibility SQL.

- [ ] **Step 9: Add the zero-active workflow gate**

  Add the closed `aiZeroActiveGate` field only to the canonical `deploy_ai`
  context variant and pass it only to context validation. Do not add another
  top-level input or store the attestation in generated config, Worker
  variables, logs, or evidence.

- [ ] **Step 10: Run GREEN verification**

  Run the commands from Step 5, then:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  ```

  Expected GREEN: all commands exit zero and query tests prove exact lifecycle
  boundaries.

- [ ] **Step 11: Review and commit**

  Require database-boundary, owner-scope, response-shape, and workflow-gate
  review with zero Critical and zero Important findings.

  Stage only this task's literal source/test/workflow paths and deterministic
  simple/technical references:

  ```powershell
  $task4ReferenceSources = @(
    'src/domain/operations/temporary-preview-fault.ts',
    'src/server/env.ts',
    'src/server/client-binding-boundary.ts',
    'src/data/phase-b-ai-usage-source.ts',
    'src/server/api/diagnostic-routes.ts',
    'scripts/run-preview-acceptance-controller.ts',
    'scripts/prepare-preview-acceptance-deploy-config.ts',
    'scripts/validate-preview-deploy-config.ts'
  )
  $task4Paths = @(
    $task4ReferenceSources
    '.github/workflows/preview.yml'
    'tests/unit/scripts/preview-acceptance-window.test.ts'
    'tests/unit/scripts/preview-acceptance-controller.test.ts'
    'tests/unit/server/wrangler-routing.test.ts'
    'tests/unit/server/env.test.ts'
    'tests/integration/data/phase-b-ai-usage-source.test.ts'
    'tests/integration/jobs/temporary-preview-fault.test.ts'
    'tests/security/secret-bundle.test.ts'
    'tests/e2e/foundation-diagnostics.spec.ts'
    'tests/worker/diagnostics.test.ts'
    'tests/unit/ci/workflows.test.ts'
    foreach ($source in $task4ReferenceSources) {
      "docs/reference/simple/$($source -replace '\.ts$','.md')"
      "docs/reference/technical/$($source -replace '\.ts$','.md')"
    }
  )
  git add -- $task4Paths
  $unexpected = @(git diff --cached --name-only | Where-Object { $_ -notin $task4Paths })
  $unstaged = @(git diff --name-only -- $task4Paths)
  if ($unexpected.Count -ne 0 -or $unstaged.Count -ne 0) {
    throw 'Task 4 exact staging mismatch'
  }
  git diff --cached --check
  git commit -m "feat: gate AI evidence on exact settled usage"
  ```

---

## Task 5: Admit One AI Evidence Instant and Reject Duplicate Terminals

**Files:**

- Modify: `src/jobs/phase-b-ai-usage-evidence.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `scripts/resolve-preview-observer-run.ts`
- Modify: `scripts/run-preview-acceptance-controller.ts`
- Modify: `scripts/validate-preview-observer-state.ts`
- Modify: `scripts/print-safe-tail.ts`
- Create: `scripts/validate-preview-ai-browser-request.ts`
- Modify: `.github/workflows/preview.yml`
- Test: `tests/integration/jobs/phase-b-ai-usage-evidence.test.ts`
- Test: `tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts`
- Test: `tests/integration/jobs/temporary-preview-fault.test.ts`
- Test: `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- Test: `tests/unit/scripts/preview-acceptance-controller.test.ts`
- Test: `tests/unit/scripts/preview-observer-state.test.ts`
- Test: `tests/unit/scripts/print-safe-tail.test.ts`
- Test: `tests/unit/scripts/preview-ai-browser-request.test.ts`
- Test: `tests/unit/ci/workflows.test.ts`
- Test: `tests/worker/ai-category-proposals.test.ts`
- Modify matching simple and technical reference pages.

**Interfaces:**

- Produces:

  ```ts
  export type ScheduledPhaseBAiUsageResult = "waiting" | "emitted";

  export async function runScheduledPhaseBAiUsageEvidence(
    scheduledAt: Date,
    window: PreviewAiEvidenceWindow,
    dependencies: PhaseBAiUsageEvidenceDependencies,
    write?: (entry: PhaseBAiUsageEvidenceEntry) => void,
  ): Promise<ScheduledPhaseBAiUsageResult>;

  export interface PreviewAiObserverState {
    readonly signal: "listening" | "succeeded" | "failed";
    readonly uniqueness: "listening" | "succeeded" | "failed";
    readonly signalObservedAt: Date | null;
  }

  export async function readPreviewAiObserverState(
    handle: PreviewObserverRunHandle,
    dependencies: PreviewObserverResolutionDependencies,
  ): Promise<PreviewAiObserverState>;

  export interface PreviewAiBrowserSafeResult {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly succeeded: boolean;
    readonly statusClass:
      | "success"
      | "http_failure"
      | "aborted"
      | "network_failure"
      | "page_disconnected";
  }

  export async function executeOneBrowserScopedAiRequest(
    privateRequestFactory: () => Promise<{
      readonly input: RequestInfo | URL;
      readonly init: RequestInit;
    }>,
    timing: {
      readonly approvalAt: Date;
      readonly evidenceScheduledAt: Date;
    },
    dependencies: PreviewAiBrowserRequestDependencies,
  ): Promise<PreviewAiBrowserSafeResult>;
  ```

- Consumes: Task 4's parsed AI evidence window and exact eligibility count.
- Produces for live execution: one observed terminal at the sole eligible
  scheduled instant.

- [ ] **Step 1: Write RED scheduled-entry tests**

  The preceding and following one-minute ticks return before the generic
  wall-clock lifetime assertion and without constructing database dependencies.
  The exact scheduled timestamp proceeds only after enforcing that wall-clock
  execution remains before expiry. Delayed exact-tick delivery at or after
  expiry fails closed.

- [ ] **Step 2: Write RED eligibility behavior tests**

  Require:

  ```text
  created 0, eligible 0 -> "waiting", no monthly/status/calendar reads
  created 1, eligible 0 -> "waiting", no terminal
  created 1, eligible 1 -> existing reads, one terminal, "emitted"
  created >1 or eligible >1 -> closed inconsistent failure and throw
  every impossible count relationship -> closed inconsistent failure and throw
  ```

  Duplicate delivery of the exact scheduled event may produce two terminal
  records; observer acceptance must reject the duplicate rather than claiming
  emission-level at-most-once.

- [ ] **Step 3: Write RED AI observer uniqueness tests**

  In `--ai-usage-only` mode, retain the first safe terminal until the exact
  controller-supplied `expiresAt + 3 minutes` close, fail on a second or mixed
  terminal, and print the first only when that window closes with exactly one.
  Add `--ai-usage-signal-only` for a concurrent job in the same observer run;
  it exits zero on the first exact terminal and emits nothing. It exits nonzero
  on end-of-stream without a match, malformed/mixed input, or upstream failure.
  The controller observes only the exact signal-listener step completion
  timestamp plus successful containing-job state, never logs. Both modes
  require the `ai_succeeded` expectation; a canonical AI failure record makes
  the jobs fail.

  Sync-suppression, maintenance, and replay-fenced restore uniqueness modes
  retain Task 3's complete 120-second windows. Suppression and restore
  signal-only companions remain output-free; foundation, fault, and role-probe
  retain their exact first-terminal signal modes with no uniqueness claim.
  Assert all branches, early and worst-case AI close times, missing signal,
  zero/duplicate/mixed input, premature end-of-stream, upstream failure, and
  the 65-minute absolute ceiling.

  In the browser-request tests, execute the helper only inside a simulated page
  context. Keep session, anti-forgery state, event reference, idempotency value,
  route input, and request body inside `privateRequestFactory`. With injected
  monotonic/UTC clocks, fetch, abort controller, and timer, prove exactly one
  fetch, a 35-second abort, response-byte drain/discard, zero retry after every
  failure/uncertainty, approval-to-start strictly greater than zero and no more
  than 60 seconds, completion strictly before evidence, closed status classes,
  and no protected field in return, stdout, stderr, or thrown errors. Exact
  clock tests reject zero and 60 seconds plus one millisecond and accept one
  millisecond and exactly 60 seconds.

- [ ] **Step 4: Run tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/integration/jobs/phase-b-ai-usage-evidence.test.ts tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts tests/integration/jobs/temporary-preview-fault.test.ts tests/unit/scripts/preview-observer-run-resolution.test.ts tests/unit/scripts/preview-acceptance-controller.test.ts tests/unit/scripts/preview-observer-state.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/unit/scripts/preview-ai-browser-request.test.ts tests/unit/ci/workflows.test.ts
  pnpm.cmd exec vitest run --project worker tests/worker/ai-category-proposals.test.ts
  ```

  Expected RED: the gated result and uniqueness behavior do not exist.

- [ ] **Step 5: Implement exact scheduled dispatch**

  First preserve all existing candidate-wide structural selector, attestation,
  environment, mutual-exclusion, and protected-window guards. Then route by
  `ScheduledController.cron`. For permanent quarter-hour and daily cron values,
  preserve the existing wall-clock lifetime assertion before executing only
  their maintenance/backup paths; they never enter AI timestamp logic, even
  when their timestamp equals the evidence minute. Malformed, expired, or
  prohibited candidates therefore fail closed before permanent work.

  Only the temporary one-minute acceptance branch compares `scheduledTime` to
  the admitted AI instant before its wall-clock lifetime assertion or database
  dependency construction. Return for a noneligible one-minute AI tick. For the
  exact tick, run the tick-specific wall-clock expiry and protected-window
  assertion before any read.

  Tests cover valid quarter-hour and daily invocations at matching and
  nonmatching AI timestamps, malformed/expired/protected-window candidate
  failures on each permanent cron, plus eligible and ineligible one-minute
  ticks.

- [ ] **Step 6: Implement eligibility gating**

  Extend `PhaseBAiUsageEvidenceDependencies` with
  `readCandidateRequestCounts`. Do not call the existing monthly evidence job
  until both created and eligible counts are exactly one.

- [ ] **Step 7: Add dynamic two-job AI observation**

  Define:

  ```text
  candidate workflow bound = 30 minutes
  candidate lifetime = 30 minutes
  duplicate-close and resolver margin = 3 minutes
  AI uniqueness closes = actual expiresAt + 3 minutes
  AI absolute tail ceiling = 63 minutes
  AI observer job timeout = 65 minutes
  ordinary observer tail/job bounds remain unchanged
  ```

  Run signal and uniqueness tail jobs concurrently in the same AI observer run
  and require both listener steps active before deployment. The uniqueness
  printer exits at the actual close time; 63/65 minutes are failure ceilings,
  not normal wait times. Poll the signal job every five seconds and dispatch
  rollback within 50 monotonic seconds of detection and within 59 seconds of
  the allowlisted listener step's `completed_at` timestamp. AI controller
  boundary tests accept exactly 59 seconds and reject 59 seconds plus one
  millisecond. If signal success has not been safely observed at the
  actual expiry, immediately dispatch and verify normal rollback at that
  deadline while uniqueness observation continues to expiry plus three
  minutes. Never wait for the 63/65-minute ceilings to roll back. Await
  uniqueness success afterward.

  Workflow/controller tests cover early deployment, the worst permitted
  candidate delay, missing/failed jobs, a permanent cron immediately after
  expiry, and intervening quarter-hour/daily permanent crons. No candidate
  remains deployed past actual expiry.

- [ ] **Step 8: Preserve the existing AI request contract**

  Worker tests must continue proving that the route accepts only event reference
  and idempotency input, authenticates session and anti-forgery state, builds
  provider input server-side, and never returns or logs prompt/provider content.

  Implement `executeOneBrowserScopedAiRequest()` as page-context-only code. It
  calls the private factory and fetch exactly once, starts a 35-second monotonic
  abort timer, drains and discards response bytes, clears the timer, validates
  the safe timeline, and returns only `PreviewAiBrowserSafeResult`. It has no
  retry branch and never serializes or logs the factory result.

- [ ] **Step 9: Run GREEN verification**

  Run the focused commands from Step 4, then:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd docs:check
  pnpm.cmd build
  pnpm.cmd security:scan
  ```

  Expected GREEN: all commands exit zero and AI-only observation rejects a
  duplicate same-timestamp delivery.

- [ ] **Step 10: Review and commit**

  Require independent timing, SQL-gate, observer-lifetime, duplicate-detection,
  and request-contract review with zero Critical and zero Important findings.

  Stage only this task's literal source/test/workflow paths and deterministic
  simple/technical references:

  ```powershell
  $task5ReferenceSources = @(
    'src/jobs/phase-b-ai-usage-evidence.ts',
    'src/jobs/scheduled.ts',
    'scripts/resolve-preview-observer-run.ts',
    'scripts/run-preview-acceptance-controller.ts',
    'scripts/validate-preview-observer-state.ts',
    'scripts/print-safe-tail.ts',
    'scripts/validate-preview-ai-browser-request.ts'
  )
  $task5Paths = @(
    $task5ReferenceSources
    '.github/workflows/preview.yml'
    'tests/integration/jobs/phase-b-ai-usage-evidence.test.ts'
    'tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts'
    'tests/integration/jobs/temporary-preview-fault.test.ts'
    'tests/unit/scripts/preview-observer-run-resolution.test.ts'
    'tests/unit/scripts/preview-acceptance-controller.test.ts'
    'tests/unit/scripts/preview-observer-state.test.ts'
    'tests/unit/scripts/print-safe-tail.test.ts'
    'tests/unit/scripts/preview-ai-browser-request.test.ts'
    'tests/unit/ci/workflows.test.ts'
    'tests/worker/ai-category-proposals.test.ts'
    foreach ($source in $task5ReferenceSources) {
      "docs/reference/simple/$($source -replace '\.ts$','.md')"
      "docs/reference/technical/$($source -replace '\.ts$','.md')"
    }
  )
  git add -- $task5Paths
  $unexpected = @(git diff --cached --name-only | Where-Object { $_ -notin $task5Paths })
  $unstaged = @(git diff --name-only -- $task5Paths)
  if ($unexpected.Count -ne 0 -or $unstaged.Count -ne 0) {
    throw 'Task 5 exact staging mismatch'
  }
  git diff --cached --check
  git commit -m "feat: make AI acceptance evidence causal"
  ```

---

## Task 6: Enforce Backup Policy, Cleanup Order, and Temporary Inventory

**Files:**

- Modify: `scripts/scan-release.ts`
- Create: `scripts/preview-acceptance-cleanup-inventory.ts`
- Create: `scripts/run-preview-normal-deploy.ts`
- Create: `scripts/privacy-safe-git-remote.ts`
- Modify: `docs/reference/simple/scripts/scan-release.md`
- Modify: `docs/reference/technical/scripts/scan-release.md`
- Create:
  `docs/reference/simple/scripts/preview-acceptance-cleanup-inventory.md`
- Create:
  `docs/reference/technical/scripts/preview-acceptance-cleanup-inventory.md`
- Create: `docs/reference/simple/scripts/run-preview-normal-deploy.md`
- Create: `docs/reference/technical/scripts/run-preview-normal-deploy.md`
- Create: `docs/reference/simple/scripts/privacy-safe-git-remote.md`
- Create: `docs/reference/technical/scripts/privacy-safe-git-remote.md`
- Create: `tests/unit/scripts/preview-normal-deploy.test.ts`
- Create: `tests/unit/scripts/privacy-safe-git-remote.test.ts`
- Create: `tests/security/r2-deletion-capability.test.ts`
- Create: `tests/security/live-acceptance-closure.test.ts`
- Modify: `tests/security/temporary-surface-cleanup.test.ts`
- Modify: `.superpowers/sdd/live-acceptance-runbook-audit.md`
- Modify: `.superpowers/sdd/fault-cleanup-plan-map-report.md`
- Modify: `docs/operations/environments.md`
- Modify: `docs/operations/incident-runbook.md`
- Modify: `docs/operations/cost-review.md`
- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/calendar-setup-evidence.md`
- Create: `docs/operations/phase-c-handoff.md`
- Modify:
  `docs/superpowers/plans/2026-07-27-listener-before-activation-restore-retry.md`
- Modify:
  `docs/superpowers/specs/2026-07-27-listener-before-activation-restore-retry-design.md`
- Modify:
  `docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md`
- Modify:
  `docs/superpowers/specs/2026-07-28-phase-b-acceptance-instrumentation-design.md`

**Interfaces:**

- Produces:

  ```ts
  export interface R2DeletionCapabilityFinding {
    readonly path: string;
    readonly capability:
      | "adapter"
      | "failed_verification_cleanup"
      | "validated_retention"
      | "unexpected";
  }

  export function scanR2DeletionCapabilities(
    sources: ReadonlyMap<string, string>,
  ): readonly R2DeletionCapabilityFinding[];

  export type PhaseBAcceptancePathDisposition =
    | "delete_dedicated"
    | "unwind_shared"
    | "retain_permanent"
    | "retain_historical";

  export interface PhaseBAcceptancePathClassification {
    readonly path: string;
    readonly disposition: PhaseBAcceptancePathDisposition;
  }

  export const PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION:
    readonly PhaseBAcceptancePathClassification[];

  export function task9ChangedPathManifest():
    readonly string[];

  export interface PreviewNormalDeploySafeResult {
    readonly outcome: "deployed";
    readonly startedAt: string;
    readonly completedAt: string;
  }

  export async function runPreviewNormalDeploy(
    input: {
      readonly reviewedBranch: "codex/phase-b-foundation";
      readonly reviewedCommit: string;
    },
    dependencies: PreviewNormalDeployDependencies,
  ): Promise<PreviewNormalDeploySafeResult>;

  export interface PrivacySafeGitRemoteResult {
    readonly succeeded: true;
    readonly exactTipMatch: true;
  }

  export async function runPrivacySafeGitRemote(
    input:
      | {
          readonly operation: "assert_tip";
          readonly reviewedBranch: "codex/phase-b-foundation";
          readonly expectedCommit: string;
        }
      | {
          readonly operation: "push_exact";
          readonly reviewedBranch: "codex/phase-b-foundation";
          readonly expectedParent: string;
          readonly expectedCommit: string;
        },
    dependencies: PrivacySafeGitRemoteDependencies,
  ): Promise<PrivacySafeGitRemoteResult>;
  ```

- Permanent allowlist:

  ```text
  src/data/backup/r2-object-store.ts -> shared adapter only
  src/jobs/create-daily-backup.ts -> same-invocation failed-verification cleanup
  src/jobs/purge-expired-backups.ts -> independently validated 30-day retention
  ```

- [ ] **Step 1: Write RED R2 capability tests**

  Assert the exact three production paths and two caller capabilities. Inject
  fixtures that hide deletion behind an imported factory, renamed dependency,
  callback, workflow command, and temporary acceptance module; each must fail.
  Assert no temporary path can import, inject, construct, or invoke deletion.

- [ ] **Step 2: Write RED closure-order tests**

  Parse active runbook/controller instructions and require this strict order:

  ```text
  Task 9 cleanup reviewed and deployed
  < normal health/signed-in/two-schedule/temporary-absence proofs
  < disposable branch deletion and absence proof
  < replay-marker deletion
  ```

  Assert provider deletion remains manual and no workflow receives a deletion
  operation.

  In `tests/unit/scripts/preview-normal-deploy.test.ts`, write RED tests for the
  permanent post-cleanup runner. With injected UTC/monotonic clocks and
  argument-array subprocess/provider adapters, require canonical 40-hex input,
  boolean-only remote-tip equality immediately before dispatch, one bounded
  dispatch interval, exactly one matching workflow run with the reviewed head
  commit, successful run/job state, and exactly one fixed-name attribution
  artifact with the exact schema from Task 9. Reject branch movement,
  zero/duplicate/mismatched runs or artifacts, stale timestamps, wrong commit,
  failed state, child error, and any raw run handle, commit, response, link,
  command argument, environment value, or provider data on stdout/stderr.
  Return only `PreviewNormalDeploySafeResult`.

  In `tests/unit/scripts/privacy-safe-git-remote.test.ts`, write RED tests for
  `assert_tip` and `push_exact`. Require argument-array subprocess invocation,
  full capture and discard of child stdout/stderr, exact one-line canonical
  40-hex `ls-remote` parsing inside the adapter, pre-push expected-parent
  equality, post-push expected-commit equality, and only the frozen safe result
  or a constant error. Inject URL-bearing, credential-shaped, multiline,
  malformed, missing, duplicate, wrong-ref, nonzero-exit, and push-failure
  child output and prove none can reach returned values, thrown messages,
  stdout, stderr, or evidence. The adapter never accepts a remote URL as input;
  it uses only the fixed `origin` remote and allowlisted branch.

- [ ] **Step 3: Extend the temporary inventory**

  Add every Task 1-5 temporary dedicated path, test, reference, selector,
  operation, binding, timing helper, diagnostic field, observer mode, resolver,
  controller, and active operations instruction. Add shared cleanup surfaces:
  webhook, repository, Worker dependencies, diagnostics, scheduled entry,
  config validators, classifier/printer, workflow, and tests.

  Replace parallel ad hoc lists with one literal exhaustive Task 1-8
  classification map in
  `scripts/preview-acceptance-cleanup-inventory.ts`, imported by
  `tests/security/temporary-surface-cleanup.test.ts`. Every exact path is in
  exactly one frozen disposition: `delete_dedicated`, `unwind_shared`,
  `retain_permanent`, or `retain_historical`. Assert the map's four projections
  equal `TEMPORARY_PATHS`, `EXPECTED_SHARED_RESIDUE_PATHS`, and the two explicit
  retained sets, with no duplicates or unclassified Task 1-8 source, test,
  workflow, active-operations document, or simple/technical reference. Task 9's
  exact path manifest must be generated from this reviewed map; implementations
  cannot add a shared path after Task 6 without updating the map and re-reviewing
  it before Task 7.

  Classify `scripts/run-preview-normal-deploy.ts`,
  `scripts/privacy-safe-git-remote.ts`, both focused unit tests, and all four
  corresponding simple/technical reference pages as `retain_permanent`.
  Likewise retain the calendar-maintenance v2 evidence source, its focused
  test, scheduled integration, classifier/printer support, and matching
  references while unwinding only temporary acceptance branches from shared
  files.

  `task9ChangedPathManifest()` returns a frozen, ordinal-sorted, duplicate-free
  array containing exactly the `delete_dedicated` and `unwind_shared` paths;
  no retained path enters it. Its CLI mode is exactly
  `--print-task-9-paths`, prints one repository-relative path per line, and
  rejects every other argument. It prints no file content, commit, provider
  data, environment data, or diagnostic. Tests require CLI output equality
  with the in-memory manifest.

  In addition to the existing `TEMPORARY_PATHS`, classify these exact new
  dedicated paths as `delete_dedicated`:

  ```text
  docs/reference/simple/scripts/resolve-preview-observer-run.md
  docs/reference/simple/scripts/run-preview-acceptance-controller.md
  docs/reference/simple/scripts/validate-preview-ai-browser-request.md
  docs/reference/simple/scripts/validate-preview-sync-acceptance.md
  docs/reference/simple/src/data/backup/r2-backup-object-reader.md
  docs/reference/simple/src/jobs/temporary-preview-restore-production.md
  docs/reference/simple/src/server/webhooks/temporary-preview-sync-suppression.md
  docs/reference/technical/scripts/resolve-preview-observer-run.md
  docs/reference/technical/scripts/run-preview-acceptance-controller.md
  docs/reference/technical/scripts/validate-preview-ai-browser-request.md
  docs/reference/technical/scripts/validate-preview-sync-acceptance.md
  docs/reference/technical/src/data/backup/r2-backup-object-reader.md
  docs/reference/technical/src/jobs/temporary-preview-restore-production.md
  docs/reference/technical/src/server/webhooks/temporary-preview-sync-suppression.md
  scripts/resolve-preview-observer-run.ts
  scripts/run-preview-acceptance-controller.ts
  scripts/validate-preview-ai-browser-request.ts
  scripts/validate-preview-sync-acceptance.ts
  src/data/backup/r2-backup-object-reader.ts
  src/jobs/temporary-preview-restore-production.ts
  src/server/webhooks/temporary-preview-sync-suppression.ts
  tests/integration/backup/r2-backup-object-reader.test.ts
  tests/integration/jobs/temporary-preview-acceptance-routing.test.ts
  tests/unit/scripts/preview-acceptance-controller.test.ts
  tests/unit/scripts/preview-ai-browser-request.test.ts
  tests/unit/scripts/preview-observer-run-resolution.test.ts
  tests/unit/scripts/preview-sync-acceptance.test.ts
  tests/unit/server/temporary-preview-sync-suppression.test.ts
  ```

  Classify the cleanup-inventory script and references, permanent normal-deploy
  runner/test/references, permanent R2 scanner/test, closure-order test, strict
  cleanup test, Phase C handoff, and scan-release reference pages as
  `retain_permanent`. Classify the two
  `.superpowers/sdd` audit reports, this approved spec/plan, and the four
  explicitly superseded older plan/spec paths as `retain_historical`.

  Keep the normal-deploy runner/test, R2 scanner/test, and closure-order test in
  the permanent inventory.
  Create the Phase C handoff as a privacy-safe pending-completion skeleton in
  this task and classify it as a retained top-level operations document with
  stable heading/allowlist anchors. Task 10 fills those already-reviewed
  fields; it must not introduce a new unclassified operations path after
  strict cleanup review.

- [ ] **Step 4: Run tests and verify RED**

  Run:

  ```powershell
  pnpm.cmd exec vitest run --project unit tests/security/r2-deletion-capability.test.ts tests/security/live-acceptance-closure.test.ts tests/unit/scripts/preview-normal-deploy.test.ts tests/unit/scripts/privacy-safe-git-remote.test.ts
  pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts
  ```

  Expected RED: the new scanner and corrected closure instructions do not yet
  exist. Ordinary cleanup-inventory mode remains GREEN after Step 3.

- [ ] **Step 5: Implement structural scanning and the permanent safe runners**

  Use TypeScript syntax-tree inspection for production TypeScript plus explicit
  workflow/config scanning. Do not rely on a single regular expression. Return
  only paths and closed capability categories.

  Implement `runPreviewNormalDeploy()` without importing either temporary
  observer resolver or acceptance controller. Its private adapter keeps any
  numeric run identifier in process memory, invokes child commands by argument
  array, bounds run discovery to the expected workflow/event/head commit and
  closed dispatch interval, downloads only the fixed artifact name, validates
  the exact safe schema, and returns only the frozen result above. The module
  has no provider-delete capability and remains usable after Task 9 deletes all
  acceptance orchestration.

  Implement `runPrivacySafeGitRemote()` as the only permanent owner of remote
  Git tip queries and pushes. It launches `git` with argument arrays, captures
  both child streams without forwarding or logging them, validates status and
  exact output internally, and then discards both buffers. `assert_tip`
  validates exactly one canonical 40-hex row for the fixed branch.
  `push_exact` first proves that row equals `expectedParent`, pushes only
  `HEAD` to the fixed allowlisted branch, then re-resolves and proves equality
  with `expectedCommit`. Its CLI emits only `True` on complete success or a
  constant safe failure; it never emits a commit, ref result, URL, command
  argument, child output, or remote configuration. `runPreviewNormalDeploy()`
  imports this adapter rather than owning a second remote-Git subprocess path.

- [ ] **Step 6: Correct active provider-cleanup instructions**

  Preserve historical records but add this explicit supersession meaning to
  each of the four exact 2026-07-27/2026-07-28 plan/spec paths listed above:
  post-acceptance provider cleanup is governed by this plan's Task 10; do not
  execute the older marker-first sequence. The required order is reviewed
  cleanup deployment, normal-state proof, disposable-branch deletion and
  absence proof, then replay-marker deletion last. Active instructions use the
  same branch-first/marker-last order. If branch deletion or absence proof is
  uncertain, retain the marker and stop.

- [ ] **Step 7: Run documentation and security verification**

  First require both reviewed authoring documents to be byte-identical to the
  prerequisite authoring commit retained in the SDD ledger:

  ```powershell
  git diff --quiet $authoringCommit -- docs/superpowers/plans/2026-07-29-phase-b-live-acceptance-closure.md docs/superpowers/specs/2026-07-29-phase-b-live-acceptance-closure-design.md
  if ($LASTEXITCODE -ne 0) {
    throw 'Reviewed authoring documents changed after approval'
  }
  ```

  Then run:

  ```powershell
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  pnpm.cmd exec vitest run --project unit tests/security/r2-deletion-capability.test.ts tests/security/live-acceptance-closure.test.ts tests/security/temporary-surface-cleanup.test.ts tests/unit/scripts/preview-normal-deploy.test.ts tests/unit/scripts/privacy-safe-git-remote.test.ts
  ```

  Expected: all non-strict commands exit zero.

  Then run strict pre-cleanup mode separately:

  ```powershell
  & { $env:PREVIEW_ACCEPTANCE_CLEANUP_ASSERT='true'; pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts }
  ```

  Expected intentional RED: the command exits nonzero and reports exactly the
  reviewed Task 9 temporary-residue inventory—no missing item and no permanent
  false positive. Preserve this expected-failure evidence before freezing the
  candidate.

- [ ] **Step 8: Review and commit**

  Stage only this task's literal paths, prove the cached path set is exact, then
  require independent backup-policy, AST/scanner, cleanup-order, and residue
  inventory review of the cached diff with zero Critical and zero Important
  findings.

  ```powershell
  $task6Paths = @(
    'scripts/scan-release.ts',
    'scripts/preview-acceptance-cleanup-inventory.ts',
    'scripts/run-preview-normal-deploy.ts',
    'scripts/privacy-safe-git-remote.ts',
    'docs/reference/simple/scripts/scan-release.md',
    'docs/reference/technical/scripts/scan-release.md',
    'docs/reference/simple/scripts/preview-acceptance-cleanup-inventory.md',
    'docs/reference/technical/scripts/preview-acceptance-cleanup-inventory.md',
    'docs/reference/simple/scripts/run-preview-normal-deploy.md',
    'docs/reference/technical/scripts/run-preview-normal-deploy.md',
    'docs/reference/simple/scripts/privacy-safe-git-remote.md',
    'docs/reference/technical/scripts/privacy-safe-git-remote.md',
    'tests/unit/scripts/preview-normal-deploy.test.ts',
    'tests/unit/scripts/privacy-safe-git-remote.test.ts',
    'tests/security/r2-deletion-capability.test.ts',
    'tests/security/live-acceptance-closure.test.ts',
    'tests/security/temporary-surface-cleanup.test.ts',
    '.superpowers/sdd/live-acceptance-runbook-audit.md',
    '.superpowers/sdd/fault-cleanup-plan-map-report.md',
    'docs/operations/environments.md',
    'docs/operations/incident-runbook.md',
    'docs/operations/cost-review.md',
    'docs/operations/phase-b-evidence.md',
    'docs/operations/calendar-setup-evidence.md',
    'docs/operations/phase-c-handoff.md',
    'docs/superpowers/plans/2026-07-27-listener-before-activation-restore-retry.md',
    'docs/superpowers/specs/2026-07-27-listener-before-activation-restore-retry-design.md',
    'docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md',
    'docs/superpowers/specs/2026-07-28-phase-b-acceptance-instrumentation-design.md'
  )
  git add -- $task6Paths
  $cachedPaths = @(git diff --cached --name-only)
  if (Compare-Object ($task6Paths | Sort-Object) ($cachedPaths | Sort-Object)) {
    throw 'Task 6 cached path set mismatch'
  }
  git diff --cached --check
  # Review this exact cached diff before committing.
  git commit -m "test: enforce live acceptance closure policy"
  ```

---

## Task 7: Complete Gate 0 and Freeze the Immutable Candidate

**Files:**

- Modify: `docs/operations/phase-b-evidence.md`
- Do not add live-pass claims in this task.

- [ ] **Step 1: Run focused cross-slice tests**

  Run the focused commands from Tasks 1-6. Expected GREEN: every ordinary
  focused command exits zero; strict post-cleanup residue remains the single
  documented RED assertion.

- [ ] **Step 2: Run the full local gate**

  Run:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd test:unit
  pnpm.cmd test:contract
  pnpm.cmd test:worker
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  pnpm.cmd test:e2e
  pnpm.cmd check
  ```

  Expected GREEN: every command exits zero with only previously classified
  sandbox warnings.

- [ ] **Step 3: Run explicit preview and production builds**

  Run:

  ```powershell
  & { $env:CLOUDFLARE_ENV='preview'; pnpm.cmd build }
  pnpm.cmd deploy:check:preview
  & { $env:CLOUDFLARE_ENV='production'; pnpm.cmd build }
  pnpm.cmd deploy:check:production
  ```

  Expected GREEN: all four commands exit zero; preview validation uses the
  explicit preview build environment.

- [ ] **Step 4: Perform static privacy and scope checks**

  Prove with bounded counts/booleans:

  ```text
  zero migration changes
  zero new secret names
  zero secret assignments or values
  zero event-level Google write surface
  backup key version remains 1
  exactly two permanent R2 deletion callers
  normal preview/production have exactly two schedules
  candidate files contain no raw protected values
  reviewed plan/spec have zero diff from the authoring commit
  ```

- [ ] **Step 5: Commit candidate evidence status**

  Record implementation verification only. Leave live evidence fields
  unclaimed. Stage no setback, task-report, plan, or unrelated documentation.

  ```powershell
  git add -- docs/operations/phase-b-evidence.md
  $cachedPaths = @(git diff --cached --name-only)
  if ($cachedPaths.Count -ne 1 -or $cachedPaths[0] -ne 'docs/operations/phase-b-evidence.md') {
    throw 'Task 7 cached path set mismatch'
  }
  git diff --cached --check
  git commit -m "docs: freeze Phase B live acceptance candidate"
  ```

- [ ] **Step 6: Obtain exact-tip whole-branch review**

  Give a fresh reviewer the approved spec, this plan, all task reports, test
  evidence, complete branch diff, and exact candidate tip. Require zero Critical
  and zero Important findings on that exact tip. If a finding requires a fix,
  commit it, re-run affected gates, and repeat exact-tip review until clean.

- [ ] **Step 7: Push and bind immutably**

  Use the permanent tested `scripts/privacy-safe-git-remote.ts` `push_exact`
  operation; do not invoke a raw remote Git command. Require its sole output to
  be `True`, which proves expected-parent and post-push local/remote equality
  while child output remains captured and discarded. Retain the exact commit
  only in ignored local evidence and immutable workflow artifacts until the
  later tracked evidence commit.

---

## Task 8: Execute the Observer-First Live Acceptance Sequence

**Files:**

- Append only privacy-safe facts to ignored local evidence during execution.
- Do not update tracked evidence in this task. Task 10 transfers the final
  reviewed privacy-safe facts after Task 9 cleanup is deployed and provider
  cleanup is complete.

**Precondition:** The exact Task 7 candidate is independently reviewed, pushed,
and local/remote equality is true.

- [ ] **Step 1: Reconcile current live state without repeating single-attempt work**

  Compare the active evidence map, current normal provider state, restore replay
  marker state, and disposable branch state using signed-in controls and
  bounded facts. Reuse already-valid immutable evidence. Never retry a
  completed, failed, or uncertain fenced restore.

- [ ] **Step 2: Deploy and prove the reviewed normal artifact**

  Deploy the exact candidate's normal configuration. Prove unauthenticated
  health, authenticated diagnostics/calendar reads, exactly two schedules, no
  temporary binding, and no temporary one-minute route.

- [ ] **Step 3: Capture the permanent maintenance baseline**

  Start a fresh `calendar_maintenance` observer so its listener is proved active
  no earlier than five minutes and no later than two minutes before a selected
  quarter-hour tick. Put that exact canonical tick in
  `maintenanceScheduledAt` before observer dispatch and require the resolver,
  printer, state reader, and controller to preserve it unchanged. Revalidate
  activity immediately before that tick. Retain observation through
  `maintenanceScheduledAt + 120 seconds` and require exactly one fixed terminal
  from that scheduled event; reject earlier, later, or timestamp-missing
  events. This occurs before any remaining legacy or temporary candidate.

- [ ] **Step 4: Complete any still-pending legacy gates**

  For each pending role probe, restore, foundation probe, and six fault
  scenarios:

  For any still-pending role probe or fenced restore, use only the temporary
  operations added to the reviewed current workflow. Resolve the observer from
  its safe dispatch interval inside both controller and candidate processes,
  require the exact Task 7 `github.sha`, and revalidate the job/listener state
  immediately before deployment. Never dispatch the historical three-input
  workflow. Preserve the restore marker and never retry a completed, failed, or
  uncertain restore.

  If a role probe or restore remains pending, inspect only whether the two
  approved temporary restore secret names exist. When a required name is
  absent, stop and have the owner enter its value directly in signed-in
  Cloudflare controls; automation never receives it. Verify name/type only.
  Before either candidate, require the operation-scoped `restore_pair`
  provider contract: the exact normal inventory plus only those two
  `secret_text` names.

  Immediately before `deploy_restore`, privately revalidate the authorized
  disposable target, the current replay-marker state, and the
  single-attempt/non-retry status. Derive
  `restoreAdmissionGate=verified` only from that fresh action-time check. Any
  ambiguity stops without dispatch and retains both the disposable branch and
  the replay marker.

  Retain the names only across the ordered role-probe/restore pair. The role
  probe's scoped rollback/closure may unlock only the restore at the same
  immutable commit; if restore is already completed, failed, uncertain, or not
  authorized, it may unlock only cleanup. After the final scoped
  rollback/closure, obtain action-time approval to delete both names. Then
  dispatch `verify_cleanup`, require both names absent, rerun the unchanged
  strict normal provider-state contract, and produce the fixed-shape `normal`
  cleanup proof. Record name-only creation/deletion facts only in ignored local
  evidence during Task 8; Task 10 transfers the reviewed privacy-safe facts
  into `docs/operations/credential-change-log.md`. No foundation, fault,
  suppression, AI, or Task 9 action may proceed from a `restore_pair` closure
  without that strict cleanup proof.

  Restore uses signal plus replay-safe 120-second uniqueness listeners. Role
  probe, foundation, and fault candidates use their exact first-terminal
  signal listener only; normal rollback may not finish before their next
  one-minute delivery, so do not assert duplicate absence for those families.

  ```text
  exact family-specific listener set active
  -> candidate attribution verified
  -> signal job safely succeeds
  -> normal rollback dispatched within the fixed deadline
  -> restore uniqueness closes with exactly one terminal; other families make no duplicate claim
  -> exact normal artifact plus restore-pair binding profile proved
  -> fresh signed-in diagnostics/calendar reads
  -> scoped rollback closure verified
  -> after the pair, names deleted and strict normal cleanup proved
  ```

  Stop on missing, duplicate, mixed, late, or misattributed evidence.

- [ ] **Step 5: Prove normal synchronization**

  Because legacy candidates may have run since the permanent baseline, start a
  fresh maintenance observer with the selected tick frozen as canonical
  `maintenanceScheduledAt`, require exactly one matching terminal through that
  instant plus 120 seconds, reject every other scheduled instant, and begin
  this test immediately after that newly completed tick. Prove connected
  authorization, fresh signed-in diagnostics/calendar reads, exactly two
  schedules, no temporary binding, and normal retry/failure counter baselines.
  Freeze every other calendar edit until this observation closes.

  Obtain action-time approval for one disposable private event edit; approval
  expires after 60 seconds. Immediately after approval and before the edit,
  repeat the connected, signed-in, schedule, binding, and counter checks. Begin
  the edit no earlier than approval and no later than approval plus 60 seconds.
  Record only edit-start, provider-completion, and Vision-visible UTC times.

  Poll the signed-in Vision event view every five seconds without copying
  payload. Require visibility within 120 seconds and before the next
  maintenance tick. Re-read retry/failure counters after visibility, compute
  exact before/after deltas, and pass them to
  `validateNormalSyncObservation`; both deltas must be zero. Release the edit
  freeze only after the observation closes.

- [ ] **Step 6: Prove one missed signal and repair**

  Start a fresh sync-suppression observer. Deploy the two-schedule suppression
  candidate, verify its immutable attribution, and freeze every other calendar
  edit through repair closure. Before approval, require the observer listener
  active, no terminal, the exact protected window, two schedules, normal
  retry/failure baselines, a fresh safe sync anchor, five minutes of candidate
  lifetime, and enough time to resolve a just-in-time repair observer.

  Obtain action-time approval for exactly one disposable edit; approval expires
  after 60 seconds. Immediately after approval and before the edit, repeat
  candidate attribution, observer activity, no-terminal, protected-window,
  schedule, counter, safe-anchor, and repair-timing checks, and require at least
  four minutes of candidate lifetime. Begin the edit within the approval
  window.

  Poll the allowlisted observer-job state every five seconds. When the signal
  job and its exact listener step succeed, emit only the fixed
  `candidate_signal_seen` controller status
  and dispatch normal rollback within 50 monotonic seconds of detection and
  within 59 seconds of the allowlisted listener step's `completed_at`
  timestamp, preserving the 60-real-second bound under one-second provider
  timestamp precision. Never read observer logs. Require uniqueness-job
  success with exactly one terminal when the complete 120-second window
  closes. Complete normal deployment,
  two-schedule, binding-absence, signed-in-read, and rollback-closure proofs,
  then privately confirm the edited version is not yet visible.

  Missing, duplicate, mixed, late, expired-margin, uncertain-deploy, edit, or
  observer results all fail the attempt, but first dispatch and verify normal
  rollback and closure whenever a candidate may be active. Never leave a
  failed candidate deployed.

  After rollback, re-read the safe sync anchor and recompute the first eligible
  repair tick. Require that tick to remain at least five minutes away. Dispatch
  a fresh maintenance observer five minutes before the recomputed tick with
  that exact tick frozen as canonical `maintenanceScheduledAt`; require its run
  resolved and listener active no later than two minutes before the tick.
  Re-read the anchor after listener activation and immediately before the tick.
  If the anchor changes, close that observer and recompute; proceed only when
  the same eligible tick remains valid and listener activity is proved through
  it.

  Retain the maintenance observer through
  `maintenanceScheduledAt + 120 seconds`. Require exactly one terminal from
  that scheduled event with `repairOutcome=reserved`, reject any other
  scheduled instant, require visibility before the following quarter-hour
  tick, and require exact zero retry/failure counter deltas. Release the
  no-other-edit freeze only after repair closure.

- [ ] **Step 7: Complete authentication lifecycle acceptance**

  First use the owner's signed-in browser read-only to locate the current Google
  account-choice, Vision permission, revoke-confirmation, and reconnect
  controls plus the exact visible wait points for success/cancellation. Record
  only privacy-safe control labels and state categories—never account text. If
  any control or resulting state is ambiguous, stop without clicking.

  Prove wrong-account denial through the existing Vision sign-in path without
  recording account details. Before revoking Vision's Google permission,
  re-identify the selected application and obtain action-time approval for that
  single revocation. Wait for an unambiguous provider confirmation and Vision's
  disconnected state; uncertainty stops the sequence.

  Reconnect through the existing Vision flow. The owner alone enters
  credentials, chooses the authorized account, and grants permissions;
  automation never reads them. After reconnection prove normal health,
  connected authorization, fresh signed-in diagnostics/calendar reads, exactly
  two schedules, and no temporary binding. Capture only safe state categories
  and UTC timestamps.

- [ ] **Step 8: Prove one causal AI request**

  From signed-in diagnostics, require zero active requests. Generate one
  canonical AI evidence window in the controller, then start a fresh AI
  observer with signal and uniqueness listener jobs bound to that exact window.
  Prove both listeners active through the required instants. Deploy the AI
  candidate with the same window and the zero-active gate verified.
  From that first zero-active check through rollback closure, the owner and
  controller freeze every other Vision AI action; any second created
  reservation invalidates the attempt.

  Privately select one authorized disposable event and prove the current AI
  tier permits a request without exposing event or account content.
  Before approval, privately verify exact candidate attribution, both observer
  listeners active through their required windows, no signal/terminal, zero
  active, zero candidate-window requests, zero eligible settled, and at least
  the provider's 30-second request bound plus a 60-second safety margin before
  the evidence instant. Obtain separate approval and record only its UTC
  timestamp. Approval expires after 60 seconds.

  Immediately after approval and before the fetch, revalidate candidate
  attribution, both observer listeners, zero active requests,
  zero candidate-window requests, no signal/terminal, and the same minimum
  remaining time. Require request start strictly after approval and no later
  than approval plus 60 seconds.

  From the authenticated browser page context, invoke the existing route once.
  Keep session, anti-forgery value, event reference, and idempotency value
  inside the browser closure. Use a monotonic 35-second abort deadline, drain
  and discard response bytes, and return only request start/completion UTC
  times, success boolean, and a closed transport/status class. An abort,
  disconnect, uncertain completion, or non-success class is non-retryable and
  immediately triggers normal rollback plus signed-in closure proof.

  Poll only the aggregate diagnostics until active is zero, created request
  count is exactly one, and eligible settled count is exactly one before the
  evidence instant. Assert:

  ```text
  approval < request started <= request completed
  request completed < evidenceScheduledAt <= accepted terminal
  ```

  Poll only allowlisted AI observer-job metadata every five seconds. On signal
  job success, dispatch normal rollback within 50 monotonic seconds of detection
  and within 59 seconds of the allowlisted listener step's `completed_at`
  timestamp. If no signal succeeds,
  dispatch rollback no later than the candidate's actual expiry and fail.
  Complete normal, signed-in, and closure proofs while the separate uniqueness
  job continues until actual expiry plus three minutes. Require that job to
  finalize exactly one terminal; a duplicate/mixed/late result fails without
  redeploying or retrying.

  Any ordering failure also rolls back and fails closed. Release the
  no-other-AI-action freeze only after rollback closure and uniqueness success.
  Clocked controller tests cover approval expiry, early and worst-case
  deployment, dynamic observer close, intervening permanent crons, and every
  request/evidence/terminal boundary.

- [ ] **Step 9: Audit live evidence completeness**

  For every gate, classify evidence as proved, contradicted, incomplete, or
  missing. Do not treat a narrow terminal as proof of the broader live path.
  Task 9 begins only when every pre-cleanup live requirement is proved.

---

## Task 9: Remove Every Temporary Acceptance Surface

**Files:**

- Delete all temporary files enumerated by
  `tests/security/temporary-surface-cleanup.test.ts`.
- Surgically remove temporary code from shared files enumerated in Tasks 1-6.
- Retain permanent R2 deletion and closure-order tests.
- Retain normal authentication, webhook, Queue, sync, repair, AI accounting,
  backup, restore/import, maintenance evidence, the permanent
  `--calendar-maintenance-only` mode with its exact
  `maintenanceScheduledAt + 120 seconds` uniqueness close,
  measured warnings, the two normal schedules, and one permanent guarded normal
  preview deployment path plus its permanent
  `scripts/run-preview-normal-deploy.ts` runner and
  `scripts/privacy-safe-git-remote.ts` adapter, with both tests and all
  references.

The exact shared-residue paths to unwind are:

```text
.github/workflows/preview.yml
docs/operations/cost-review.md
docs/operations/environments.md
docs/operations/incident-runbook.md
docs/operations/secrets.md
docs/reference/simple/scripts/print-safe-tail.md
docs/reference/simple/scripts/safe-tail-classifier.md
docs/reference/simple/scripts/validate-preview-deploy-config.md
docs/reference/simple/src/data/repositories/job-repository.md
docs/reference/simple/src/jobs/create-daily-backup.md
docs/reference/simple/src/jobs/scheduled.md
docs/reference/simple/src/server/api/ai-category-proposal-routes.md
docs/reference/simple/src/server/api/diagnostic-routes.md
docs/reference/simple/src/server/client-binding-boundary.md
docs/reference/simple/src/server/env.md
docs/reference/simple/src/server/webhooks/google-calendar.md
docs/reference/technical/scripts/print-safe-tail.md
docs/reference/technical/scripts/safe-tail-classifier.md
docs/reference/technical/scripts/validate-preview-deploy-config.md
docs/reference/technical/src/data/repositories/job-repository.md
docs/reference/technical/src/jobs/create-daily-backup.md
docs/reference/technical/src/jobs/scheduled.md
docs/reference/technical/src/server/api/ai-category-proposal-routes.md
docs/reference/technical/src/server/api/diagnostic-routes.md
docs/reference/technical/src/server/client-binding-boundary.md
docs/reference/technical/src/server/env.md
docs/reference/technical/src/server/webhooks/google-calendar.md
scripts/print-safe-tail.ts
scripts/safe-tail-classifier.ts
scripts/validate-preview-deploy-config.ts
src/data/repositories/job-repository.ts
src/jobs/create-daily-backup.ts
src/jobs/scheduled.ts
src/server/api/ai-category-proposal-routes.ts
src/server/api/diagnostic-routes.ts
src/server/client-binding-boundary.ts
src/server/env.ts
src/server/webhooks/google-calendar.ts
tests/e2e/foundation-diagnostics.spec.ts
tests/integration/jobs/daily-backup.test.ts
tests/integration/jobs/queue-deduplication.test.ts
tests/security/secret-bundle.test.ts
tests/unit/ci/workflows.test.ts
tests/unit/scripts/print-safe-tail.test.ts
tests/unit/scripts/production-deploy-config.test.ts
tests/unit/scripts/safe-tail-classifier.test.ts
tests/unit/server/env.test.ts
tests/unit/server/wrangler-routing.test.ts
tests/worker/ai-category-proposals.test.ts
tests/worker/diagnostics.test.ts
tests/worker/google-webhook.test.ts
```

Keep this list equal to the strict test's
`EXPECTED_SHARED_RESIDUE_PATHS`; any implementation-added shared path must be
added to both before Task 7 freezes the candidate.

The exact new Task 2-5 dedicated paths added to the strict test's pre-existing
`TEMPORARY_PATHS` and deleted in this task are:

```text
docs/reference/simple/scripts/resolve-preview-observer-run.md
docs/reference/simple/scripts/run-preview-acceptance-controller.md
docs/reference/simple/scripts/validate-preview-ai-browser-request.md
docs/reference/simple/scripts/validate-preview-sync-acceptance.md
docs/reference/simple/src/data/backup/r2-backup-object-reader.md
docs/reference/simple/src/jobs/temporary-preview-restore-production.md
docs/reference/simple/src/server/webhooks/temporary-preview-sync-suppression.md
docs/reference/technical/scripts/resolve-preview-observer-run.md
docs/reference/technical/scripts/run-preview-acceptance-controller.md
docs/reference/technical/scripts/validate-preview-ai-browser-request.md
docs/reference/technical/scripts/validate-preview-sync-acceptance.md
docs/reference/technical/src/data/backup/r2-backup-object-reader.md
docs/reference/technical/src/jobs/temporary-preview-restore-production.md
docs/reference/technical/src/server/webhooks/temporary-preview-sync-suppression.md
scripts/resolve-preview-observer-run.ts
scripts/run-preview-acceptance-controller.ts
scripts/validate-preview-ai-browser-request.ts
scripts/validate-preview-sync-acceptance.ts
src/data/backup/r2-backup-object-reader.ts
src/jobs/temporary-preview-restore-production.ts
src/server/webhooks/temporary-preview-sync-suppression.ts
tests/integration/backup/r2-backup-object-reader.test.ts
tests/integration/jobs/temporary-preview-acceptance-routing.test.ts
tests/unit/scripts/preview-acceptance-controller.test.ts
tests/unit/scripts/preview-ai-browser-request.test.ts
tests/unit/scripts/preview-observer-run-resolution.test.ts
tests/unit/scripts/preview-sync-acceptance.test.ts
tests/unit/server/temporary-preview-sync-suppression.test.ts
```

The strict map is the authority for the full delete set: the pre-existing
dedicated paths plus this literal addition list. Its four projections must
still be pairwise disjoint and exhaustive before deletion starts.

- [ ] **Step 1: Prove strict cleanup mode is RED for reviewed residue only**

  Run:

  ```powershell
  & { $env:PREVIEW_ACCEPTANCE_CLEANUP_ASSERT='true'; pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts }
  ```

  Expected RED: every reported item is in the reviewed Task 9 inventory and no
  permanent surface is classified as residue.

- [ ] **Step 2: Delete dedicated temporary files**

  Remove suppression producer/controller/resolver/ref/timing files, temporary
  AI evidence source/job surfaces already classified for Task 9, fault,
  foundation, temporary role-probe/restore runtime surfaces, their tests, and
  their generated simple/technical references.

- [ ] **Step 3: Unwind shared temporary branches**

  Remove selectors, operations, bindings, scheduled dispatch, temporary
  diagnostics aggregates, replay inspection used only by suppression, temporary
  evidence unions/printer modes, workflow inputs/jobs, candidate builders,
  active instructions, and acceptance-only tests. Preserve the permanent
  calendar-maintenance observer mode and uniqueness behavior.

  Preserve permanent code listed in the task introduction and Global
  Constraints.

  Rewrite `.github/workflows/preview.yml` to remove
  `acceptance_operation`, `acceptance_context`, `configure_ai_budget`, and every
  acceptance observer/candidate/rollback/closure/cleanup job. Retain one
  ordinary `workflow_dispatch` input named `reviewed_preview_commit`, required
  and limited to canonical lowercase 40-hex. The normal deploy job must, before
  credentials or provider mutation, require the dispatched run `head_sha`,
  `github.sha`, and checkout `HEAD` all equal that input. It checks out that
  full commit, rebuilds and validates the normal preview artifact from that
  checkout, then deploys it.

  On success, upload exactly one fixed-name
  `preview-normal-deploy-attribution-v1` artifact containing only:

  ```ts
  {
    readonly version: "vision.preview-normal-deploy-attribution/v1";
    readonly outcome: "deployed";
    readonly reviewedCommit: string;
    readonly startedAt: string;
    readonly completedAt: string;
  }
  ```

  Validate canonical UTC timestamps and exact commit equality before upload.
  Tests reject missing/mismatched commits, a mutable checkout, acceptance
  inputs/jobs, extra artifact keys, and any provider identifier, command output,
  URL, binding value, or environment value in the artifact.

- [ ] **Step 4: Turn strict cleanup mode GREEN**

  Run:

  ```powershell
  & { $env:PREVIEW_ACCEPTANCE_CLEANUP_ASSERT='true'; pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts }
  pnpm.cmd exec vitest run --project unit tests/security/r2-deletion-capability.test.ts tests/security/live-acceptance-closure.test.ts
  ```

  Expected GREEN: all commands exit zero; the two approved permanent deletion
  callers and adapter remain, with zero temporary deletion capability.

- [ ] **Step 5: Run the complete post-cleanup gate**

  Run only commands that discover the surviving post-cleanup tree:

  ```powershell
  pnpm.cmd typecheck
  pnpm.cmd test:unit
  pnpm.cmd test:contract
  pnpm.cmd test:worker
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  pnpm.cmd test:e2e
  pnpm.cmd check
  & { $env:CLOUDFLARE_ENV='preview'; pnpm.cmd build }
  pnpm.cmd deploy:check:preview
  & { $env:CLOUDFLARE_ENV='production'; pnpm.cmd build }
  pnpm.cmd deploy:check:production
  ```

  Do not rerun deleted Task 1-6 focused paths or the intentional pre-cleanup
  RED command. Expected GREEN: every listed command exits zero and normal
  preview/production contain exactly two schedules.

- [ ] **Step 6: Stage the exact cleanup tree and independently review it**

  Generate the path list only from the reviewed permanent inventory. Require
  the unstaged changed-path set within that manifest to equal it exactly, stage
  only those literal paths, then require the cached path set to remain equal.
  Preserve unrelated unstaged paths and never include them in the cleanup
  review or commit:

  ```powershell
  $cleanupPaths = @(
    pnpm.cmd exec tsx scripts/preview-acceptance-cleanup-inventory.ts --print-task-9-paths
  )
  if ($LASTEXITCODE -ne 0 -or $cleanupPaths.Count -eq 0) {
    throw 'Task 9 manifest generation failed'
  }
  if (($cleanupPaths | Sort-Object -Unique).Count -ne $cleanupPaths.Count) {
    throw 'Task 9 manifest contains duplicates'
  }
  $workingPaths = @(git diff --name-only -- $cleanupPaths)
  if (Compare-Object ($cleanupPaths | Sort-Object) ($workingPaths | Sort-Object)) {
    throw 'Task 9 working path set mismatch'
  }
  git add -- $cleanupPaths
  $cachedPaths = @(git diff --cached --name-only)
  if (Compare-Object ($cleanupPaths | Sort-Object) ($cachedPaths | Sort-Object)) {
    throw 'Task 9 cached path set mismatch'
  }
  git diff --cached --check
  $reviewedParent = git rev-parse HEAD
  if ($reviewedParent -ne $candidateCommit) {
    throw 'Task 9 parent is not the reviewed Task 7 candidate'
  }
  $reviewedTree = git write-tree
  ```

  Require exact cached-diff security/release review with zero Critical and zero
  Important findings. Review specifically for accidental removal of permanent
  recovery, synchronization, authentication, AI budget enforcement, or the
  guarded normal preview deploy path. Do not modify or restage after approval;
  any change invalidates the review and repeats this step. Keep
  `$reviewedParent` and `$reviewedTree` in the same controller process through
  Step 7; do not recompute or overwrite either value after review.

- [ ] **Step 7: Commit and push the reviewed cleanup tree**

  ```powershell
  if ((git rev-parse HEAD) -ne $reviewedParent -or
      (git write-tree) -ne $reviewedTree) {
    throw 'Parent or index changed after cleanup review'
  }
  git commit -m "chore: remove Phase B acceptance surfaces"
  $cleanupCommit = git rev-parse HEAD
  if ((git rev-parse 'HEAD^') -ne $reviewedParent -or
      (git rev-parse 'HEAD^{tree}') -ne $reviewedTree) {
    throw 'Cleanup commit differs from reviewed parent or tree'
  }
  $pushProof = & .\node_modules\.bin\tsx.cmd scripts/privacy-safe-git-remote.ts push_exact --branch codex/phase-b-foundation --expected-parent $reviewedParent --expected-commit $cleanupCommit
  if ($LASTEXITCODE -ne 0 -or $pushProof -ne 'True') {
    throw 'Privacy-safe cleanup push failed closed'
  }
  Write-Output ($pushProof -eq 'True')
  ```

  Require the sole output of the equality proof to be `True`. The adapter
  internally performs the exact one-line pre-push tip check, captures and
  discards both child streams for the push and post-push query, and returns no
  raw child output on success or failure. Never print either commit, a remote
  URL, command arguments, or provider output.

---

## Task 10: Redeploy Normal, Clean Provider Artifacts, and Complete Handoff

**Files:**

- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/calendar-setup-evidence.md`
- Modify: `docs/operations/credential-change-log.md`
- Modify: `docs/operations/phase-c-handoff.md`

- [ ] **Step 1: Deploy the exact reviewed cleanup commit**

  Invoke the permanent, tested `scripts/run-preview-normal-deploy.ts` runner;
  Task 9 has deleted the temporary resolver and acceptance controller, so no
  live step may depend on them. Give the runner only the allowlisted reviewed
  branch and the pushed, independently reviewed Task 9 cleanup commit. It
  resolves the branch tip in memory immediately before dispatch and requires
  boolean equality with that commit through the retained
  `scripts/privacy-safe-git-remote.ts` adapter, whose child streams are captured
  and discarded. Dispatch only the permanent normal path with
  `reviewed_preview_commit=<cleanup commit>`; no acceptance operation or
  context remains.

  Resolve exactly one workflow run from the closed dispatch interval, expected
  workflow, `workflow_dispatch` event, and matching head commit. Inside the run,
  require `head_sha`, `github.sha`, and checkout `HEAD` equal the input before
  credentials or provider mutation. The run rebuilds with
  `CLOUDFLARE_ENV=preview`, validates the generated normal artifact, and deploys
  only that checkout.

  Download only the fixed `preview-normal-deploy-attribution-v1` artifact from
  that run. Require its exact schema, `outcome=deployed`, canonical timestamps,
  commit equality, successful containing job/run, and artifact creation after
  dispatch. Keep the run identifier and commit comparison in memory and emit
  only boolean success. Reject a missing/duplicate/stale artifact, mutable ref,
  local build handoff, branch movement, commit mismatch, failed job/run, or
  deployment whose attribution cannot be proved.

- [ ] **Step 2: Re-prove normal post-cleanup state**

  Read only the preview Worker secret-name inventory. If
  `PREVIEW_RESTORE_DATABASE_URL` or `PREVIEW_RESTORE_TARGET_ID` still exists,
  obtain action-time approval and delete exactly those temporary names through
  signed-in Cloudflare controls without reading their values. Record each
  name-only removal in `docs/operations/credential-change-log.md`. Never alter
  the backup key or any permanent secret.

  Require:

  ```text
  unauthenticated health succeeds
  authenticated diagnostics succeeds
  authenticated calendar read succeeds
  exactly two schedules exist
  no temporary binding exists
  no temporary Worker secret exists
  no temporary one-minute dispatch exists
  ```

- [ ] **Step 3: Delete the disposable branch while the replay fence exists**

  Immediately before approval, re-read the bounded R2 marker inventory and
  require only the safe boolean that the sole replay marker still exists. Then
  obtain action-time approval. The owner uses signed-in Neon controls to delete
  only the attested disposable branch. Verify only that the branch count
  decreased by one and the selected disposable target is absent. If the marker
  is missing, or deletion/verification is uncertain, retain all remaining state
  and stop.

- [ ] **Step 4: Delete the replay marker last**

  After branch absence is proved, obtain separate action-time approval. The
  owner uses signed-in R2 controls to delete only the opaque restore-attempt
  marker without returning its key. Do not touch the protected backup prefix
  or backup key. Re-read the bounded marker inventory through signed-in controls
  and require only a safe absence boolean plus an object-count decrease of one.
  If deletion or absence proof is uncertain, stop and do not claim provider
  cleanup complete.

- [ ] **Step 5: Complete tracked evidence**

  Update `docs/operations/phase-b-evidence.md`,
  `docs/operations/calendar-setup-evidence.md`,
  `docs/operations/credential-change-log.md`, and the new authoritative
  `docs/operations/phase-c-handoff.md` with privacy-safe categories, booleans,
  counts, durations, timestamps, and the earlier immutable candidate/cleanup
  commits. Transfer the reviewed Task 8 name-only restore-secret
  creation/deletion facts from ignored local evidence into the tracked
  credential log only now; do not copy any value or unrelated local evidence.
  Do not record provider identifiers, object keys, content, prompts, responses,
  URLs, or credentials.

- [ ] **Step 6: Run the completion audit**

  For every explicit Phase B requirement, named gate, invariant, command,
  deliverable, provider cleanup, deployment state, and evidence row, identify
  authoritative current proof. Mark Phase B complete only if no item is
  contradicted, incomplete, indirect, or missing.

  Stage only the four exact evidence files first, require their working copies
  to equal the index, and capture the reviewed evidence tree before auditing:

  ```powershell
  $task10Paths = @(
    'docs/operations/phase-b-evidence.md',
    'docs/operations/calendar-setup-evidence.md',
    'docs/operations/credential-change-log.md',
    'docs/operations/phase-c-handoff.md'
  )
  git add -- $task10Paths
  $cachedPaths = @(git diff --cached --name-only)
  if (Compare-Object ($task10Paths | Sort-Object) ($cachedPaths | Sort-Object)) {
    throw 'Task 10 cached path set mismatch'
  }
  git diff --quiet -- $task10Paths
  if ($LASTEXITCODE -ne 0) {
    throw 'Task 10 working files differ from the index'
  }
  git diff --cached --check
  $reviewedEvidenceParent = git rev-parse HEAD
  if ($reviewedEvidenceParent -ne $cleanupCommit) {
    throw 'Task 10 parent is not the reviewed Task 9 cleanup commit'
  }
  $reviewedEvidenceTree = git write-tree
  pnpm.cmd docs:check
  pnpm.cmd security:scan
  pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts tests/security/r2-deletion-capability.test.ts tests/security/live-acceptance-closure.test.ts
  git diff --quiet -- $task10Paths
  if ($LASTEXITCODE -ne 0 -or (git write-tree) -ne $reviewedEvidenceTree) {
    throw 'Task 10 evidence tree changed during completion audit'
  }
  ```

  Expected GREEN: all commands exit zero on the exact staged tree. Keep
  `$reviewedEvidenceParent` and `$reviewedEvidenceTree` in the same controller
  process through Step 7 and do not recompute or overwrite either value after
  this audit.

- [ ] **Step 7: Commit, push, and hand off**

  Require the index and four working copies still equal the exact tree reviewed
  in Step 6, then commit and push:

  ```powershell
  git diff --quiet -- $task10Paths
  if ($LASTEXITCODE -ne 0 -or
      (git rev-parse HEAD) -ne $reviewedEvidenceParent -or
      (git write-tree) -ne $reviewedEvidenceTree) {
    throw 'Task 10 parent or evidence tree changed after completion audit'
  }
  git commit -m "docs: close Phase B acceptance evidence"
  if ((git rev-parse 'HEAD^') -ne $reviewedEvidenceParent -or
      (git rev-parse 'HEAD^{tree}') -ne $reviewedEvidenceTree) {
    throw 'Committed Task 10 parent/tree differs from reviewed state'
  }
  $localCommit = git rev-parse HEAD
  $pushProof = & .\node_modules\.bin\tsx.cmd scripts/privacy-safe-git-remote.ts push_exact --branch codex/phase-b-foundation --expected-parent $reviewedEvidenceParent --expected-commit $localCommit
  if ($LASTEXITCODE -ne 0 -or $pushProof -ne 'True') {
    throw 'Privacy-safe evidence push failed closed'
  }
  Write-Output ($pushProof -eq 'True')
  ```

  Require boolean-only remote/local equality from the permanent safe-Git
  adapter; its child stdout/stderr are captured and discarded and no direct
  remote Git command is allowed. Provide the owner a concise
  completed-gates,
  retained-cost-controls, key-change record, and Phase C starting-point
  summary. That final summary is constrained to the same reviewed allowlist:
  fixed categories, booleans, non-sensitive counts/durations/timestamps, key
  names and version only, and the two tracked commit references. It contains
  no provider identifier, object key, content, prompt, response, URL,
  credential, account data, database row, or raw command output.

---

## Plan Self-Review Checklist

- [ ] Every approved spec section maps to at least one task and authoritative
  verification source.
- [ ] `sync_suppression` is outside the six-value fault tuple.
- [ ] Suppression lifetime is ten minutes, with five/four-minute action gates.
- [ ] Only fully authenticated, non-replayed `exists` traffic can be
  suppressed.
- [ ] Suppression performs no durable reservation or Queue send.
- [ ] Normal sync and repair continue through the existing Queue and consumer.
- [ ] Normal visibility and repair boundaries have exact inclusive/exclusive
  tests.
- [ ] AI pre-generation zero-active proof is reachable only through existing
  authenticated preview diagnostics.
- [ ] AI eligibility counts exact `settled` only and excludes all specified
  boundary/lifecycle cases.
- [ ] Only one scheduled instant is eligible; duplicate delivery invalidates
  acceptance.
- [ ] AI observer duration covers the candidate and uniqueness window.
- [ ] Browser acceptance does not accept, read, copy, or record a prompt.
- [ ] Observer handles remain process-memory-only.
- [ ] Pending role probe/restore uses the reviewed current workflow; the
  historical workflow is never dispatched.
- [ ] Temporary acceptance has zero R2 deletion capability.
- [ ] Exactly two approved permanent deletion callers remain before and after
  Task 9.
- [ ] Preview builds use the explicit preview build environment.
- [ ] Strict cleanup mode is RED only before Task 9 and GREEN afterward.
- [ ] Disposable branch deletion precedes replay-marker deletion.
- [ ] Backup key version remains `1` and is never read or rotated.
- [ ] No step requires a new migration, secret, public route, Queue, or provider
  resource.
- [ ] No unresolved marker, ambiguous interface, or unowned requirement remains.
