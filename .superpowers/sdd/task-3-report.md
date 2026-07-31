# Task 3 report

Status: second package-review repair locally verified; third package re-review
pending.

Commit sequence:

- base before Task 3: `24e959f`
- initial Task 3 controller commit: `38bed3e991d5`
- first acceptance-gap repair: `b1935577c211`
- final re-review repair: `841bc01b600e`
- final follow-up repair: `870de3980789`
- decisive boundary repair: `2bfbc23f13c`
- final lifecycle integration: `b4f6dce`
- final package-review repair: `328b748`

The full inventory below is the exact 77-path Task 3 implementation and
report surface. The final lifecycle/package-review repairs change paths already
in that inventory. All setback-ledger paths remain separately controller-owned
and excluded from implementation scope.

## RED, GREEN, and refactor evidence

- RED: the first eight-file focused run collected 135 tests: 16 failed and
  119 passed. The new restore re-admission suite also failed collection because
  its implementation module did not exist. These failures reproduced every
  final-review category: observer timeout arithmetic, spawn ordering and
  teardown, cross-page uniqueness, caller-controlled maintenance close,
  future action completion, uncaptured restore re-admission, and stale
  inventory/report contracts.
- Interim GREEN: after the implementation pass, the same focused scope
  collected 137 tests: 134 passed and 3 failed. Those failures isolated exact
  fixture/API drift without widening product scope.
- GREEN: the identical eight-file focused scope passes all 137 tests. The
  final cross-platform teardown and cleanup correction passes 2 files and
  18 tests.
- Package GREEN: the explicit Task 3 package passes 22 files and 476 tests.
  The standalone parsed-workflow invariant passes 1 file and 2 tests.
- Refactor: maintenance observation now has one canonical tick, shared child
  teardown uses one exit-completion path, run-page validation is centralized,
  and restore re-admission uses one argument-array helper and one fixed safe
  failure. These changes preserve the reviewed lifecycle, including valid
  role-to-cleanup transitions.
- Decisive RED: the three-file boundary suite ran 70 tests: 13 failed and
  57 passed. The failures reproduced early/short maintenance settlement,
  permissive or future provider timestamps, unbounded injected proof input,
  and the absent production max-plus-one reader.
- Decisive GREEN: the identical three-file suite passes all 70 tests.
  The exact Task 3 package passes 22 files and 492 tests.
- Decisive refactor: maintenance settlement uses one paired clock loop,
  provider-second parsing uses one canonical helper, and proof bytes are
  bounded before the existing decoder/parser/lifecycle pipeline.

## Delivered

- All seven observer jobs have an 18-minute job timeout and a 16-minute inner
  timeout. A parsed-YAML test enumerates the exact job set and proves the
  two-minute outer margin.
- The tail supervisor validates both command arrays before any spawn, starts
  and confirms the consumer before starting the producer, and awaits every
  started child during success and failure teardown. Real CLI entrypoint tests
  cover success, producer failure, consumer failure, and private stream
  canaries; an injected exit-completion gate proves teardown settlement is
  awaited cross-platform.
- Observer-run resolution walks all relevant pages, preserves uniqueness
  across page boundaries, requires exact projected page shapes and
  non-increasing creation order, stops only after the dispatch horizon is
  crossed, and fails closed at the ten-page cap.
- `observerClosesAt` was removed from the canonical maintenance observation
  context, config output, workflow arguments, and public tail API. Maintenance
  derives its close internally as scheduled tick plus 120 seconds, accepts
  completion exactly at that close, never accepts while paired local wall time
  is earlier, and polls provider metadata through the inclusive close-plus-120
  settlement margin.
- The controller pairs wall and monotonic samples and rejects an action
  completion timestamp even one millisecond later than the paired wall sample
  before calculating the remaining observation deadline. Provider signal time
  must also be no later than paired detection wall time; future signals enter
  the ordinary rollback-and-closure cleanup path.
- Restore re-admission uses captured argument arrays, validates the completed
  role-probe job and canonical closure, discards both child streams, exposes
  only `Preview restore re-admission failed closed.`, and has secret-canary
  coverage. A valid role closure may admit restore; the existing
  role-to-cleanup lifecycle remains accepted. The closure proof is capped at
  8,192 bytes, with production retaining at most 8,193 raw bytes before
  overflow rejection, strict UTF-8 decoding, or JSON parsing.
- Resolver signal timestamps accept only exact whole-second canonical UTC
  instants. Maintenance provider completion is bounded inclusively from
  semantic close through settlement. Resolver documentation records the sole
  terminal-poll single-observation exception while preserving full-horizon
  polling and late-duplicate rejection.
- Mirrored simple and technical references document the same contracts. No
  backup key or required key version changed.

## Verification

- Focused final repair suite: 8 files, 137 tests passed.
- Final supervisor/cleanup correction: 2 files, 18 tests passed.
- Decisive boundary suite: 3 files, 70 tests passed.
- Explicit Task 3 package: 22 files, 492 tests passed.
- Workflow suite, including the parsed-YAML invariant: 1 file, 22 tests passed.
- `pnpm.cmd typecheck`: passed.
- Full unit stage: 95 files passed and 1 skipped; 1,352 tests passed and
  1 skipped.
- Full contract stage: 14 files and 179 tests passed.
- Full worker stage: 7 files and 106 tests passed.
- `pnpm.cmd docs:check`: passed.
- Production build: passed.
- `pnpm.cmd security:scan`: passed with fresh release evidence.
- Full `pnpm.cmd check`: passed with `WRANGLER_LOG_PATH` directed to the
  system temporary directory.
- No live provider, deployment, database, R2, Queue, browser, remote query,
  push, or other remote mutation was performed.

## Decisive-follow-up exact staged paths (13)

- `.superpowers/sdd/task-3-report.md`
- `docs/reference/simple/scripts/resolve-preview-observer-run.md`
- `docs/reference/simple/scripts/run-preview-acceptance-controller.md`
- `docs/reference/simple/scripts/run-preview-restore-readmission.md`
- `docs/reference/technical/scripts/resolve-preview-observer-run.md`
- `docs/reference/technical/scripts/run-preview-acceptance-controller.md`
- `docs/reference/technical/scripts/run-preview-restore-readmission.md`
- `scripts/resolve-preview-observer-run.ts`
- `scripts/run-preview-acceptance-controller.ts`
- `scripts/run-preview-restore-readmission.ts`
- `tests/unit/scripts/preview-acceptance-controller.test.ts`
- `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- `tests/unit/scripts/preview-restore-readmission.test.ts`

## Complete final package inventory (77)

- `.github/workflows/preview.yml`
- `.superpowers/sdd/task-3-report.md`
- `docs/operations/secrets.md`
- `docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/simple/scripts/print-safe-tail.md`
- `docs/reference/simple/scripts/resolve-preview-observer-run.md`
- `docs/reference/simple/scripts/run-preview-acceptance-controller.md`
- `docs/reference/simple/scripts/run-preview-restore-readmission.md`
- `docs/reference/simple/scripts/run-preview-tail-supervisor.md`
- `docs/reference/simple/scripts/safe-tail-classifier.md`
- `docs/reference/simple/scripts/validate-preview-deploy-config.md`
- `docs/reference/simple/scripts/validate-preview-observer-state.md`
- `docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/simple/scripts/validate-preview-sync-acceptance.md`
- `docs/reference/simple/src/data/backup/r2-backup-object-reader.md`
- `docs/reference/simple/src/jobs/calendar-maintenance-evidence.md`
- `docs/reference/simple/src/jobs/scheduled.md`
- `docs/reference/simple/src/jobs/temporary-preview-restore-production.md`
- `docs/reference/simple/src/jobs/temporary-preview-restore.md`
- `docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/technical/scripts/print-safe-tail.md`
- `docs/reference/technical/scripts/resolve-preview-observer-run.md`
- `docs/reference/technical/scripts/run-preview-acceptance-controller.md`
- `docs/reference/technical/scripts/run-preview-restore-readmission.md`
- `docs/reference/technical/scripts/run-preview-tail-supervisor.md`
- `docs/reference/technical/scripts/safe-tail-classifier.md`
- `docs/reference/technical/scripts/validate-preview-deploy-config.md`
- `docs/reference/technical/scripts/validate-preview-observer-state.md`
- `docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/technical/scripts/validate-preview-sync-acceptance.md`
- `docs/reference/technical/src/data/backup/r2-backup-object-reader.md`
- `docs/reference/technical/src/jobs/calendar-maintenance-evidence.md`
- `docs/reference/technical/src/jobs/scheduled.md`
- `docs/reference/technical/src/jobs/temporary-preview-restore-production.md`
- `docs/reference/technical/src/jobs/temporary-preview-restore.md`
- `scripts/prepare-preview-acceptance-deploy-config.ts`
- `scripts/print-safe-tail.ts`
- `scripts/resolve-preview-observer-run.ts`
- `scripts/run-preview-acceptance-controller.ts`
- `scripts/run-preview-restore-readmission.ts`
- `scripts/run-preview-tail-supervisor.ts`
- `scripts/safe-tail-classifier.ts`
- `scripts/validate-preview-deploy-config.ts`
- `scripts/validate-preview-observer-state.ts`
- `scripts/validate-preview-rollback-lifecycle.ts`
- `scripts/validate-preview-sync-acceptance.ts`
- `src/data/backup/r2-backup-object-reader.ts`
- `src/domain/operations/temporary-preview-fault.ts`
- `src/jobs/calendar-maintenance-evidence.ts`
- `src/jobs/create-daily-backup.ts`
- `src/jobs/scheduled.ts`
- `src/jobs/temporary-preview-restore.ts`
- `src/jobs/temporary-preview-restore-production.ts`
- `tests/integration/backup/r2-backup-object-reader.test.ts`
- `tests/integration/jobs/daily-backup.test.ts`
- `tests/integration/jobs/temporary-preview-acceptance-routing.test.ts`
- `tests/integration/jobs/temporary-preview-restore.test.ts`
- `tests/integration/jobs/temporary-preview-role-probe.test.ts`
- `tests/security/secret-bundle.test.ts`
- `tests/security/temporary-surface-cleanup.test.ts`
- `tests/unit/ci/workflows.test.ts`
- `tests/unit/domain/temporary-preview-fault.test.ts`
- `tests/unit/jobs/calendar-maintenance-evidence.test.ts`
- `tests/unit/jobs/temporary-preview-restore-production.test.ts`
- `tests/unit/scripts/preview-acceptance-context.test.ts`
- `tests/unit/scripts/preview-acceptance-controller.test.ts`
- `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- `tests/unit/scripts/preview-observer-state.test.ts`
- `tests/unit/scripts/preview-restore-readmission.test.ts`
- `tests/unit/scripts/preview-rollback-lifecycle.test.ts`
- `tests/unit/scripts/preview-sync-acceptance.test.ts`
- `tests/unit/scripts/preview-tail-supervisor.test.ts`
- `tests/unit/scripts/print-safe-tail.test.ts`
- `tests/unit/scripts/production-deploy-config.test.ts`
- `tests/unit/scripts/safe-tail-classifier.test.ts`
- `tests/unit/server/env.test.ts`
- `tests/unit/server/wrangler-routing.test.ts`

All `docs/operations/setbacks/**` paths remain controller-owned and excluded
from this implementation commit.

## Final canonical integration

- Review base: `24e959f5`
- Integrated implementation tip: `d6a6432`
- Integrated implementation shape: 12 implementation commits and 77 changed
  paths
- Decisive repair commits:
  - `00cd3c7` restores the production restore facade and acceptance contract.
  - `5f11f52` hardens controller lifecycle deadlines and reconciliation.
  - `0e283a3` gives the one three-process safe-tail test a bounded
    suite-load allowance.
  - `b4f6dce` forwards the controller boundary through the concrete resolver
    and all state readers, preserves the stable provider close, settles
    rollback before closure, and gives reconciliation/cleanup fresh bounded
    deadlines.
  - `328b748` closes the fresh package-review findings: provider commands
    abort and settle; provider closes require bounded provider evidence;
    rollback dispatch is reconciled; workflow stages receive separate bounded
    deadlines; and restore bodies/pages/candidates are fixed-size bounded.
  - `d6a6432` closes the second package-review findings: observer startup is
    polled without identity drift; observer lifetime covers the complete
    candidate window; uniqueness close may move only within bounded later
    provider evidence; candidate rollback verifies the exact schedule profile;
    and malformed R2 pagination envelopes fail closed.
- The first fresh package-review wave reported 2 Critical and 6 Important
  findings. Each finding has a dedicated RED case and an implemented repair;
  the second wave reported a deduplicated 2 Critical and 3 Important findings.
  Every second-wave finding also has a dedicated RED case and an implemented
  repair. A third package-review wave remains required.
- Resolver verification: 71 passed tests, zero failures.
- Controller verification: 53 passed tests, zero failures.
- Restore reader/selection verification: 38 passed tests, zero failures.
- Second-wave R2 reader verification: 25 passed tests, zero failures.
- Second-wave candidate provider-state verification: 84 passed tests, zero
  failures.
- Second-wave observer/controller/workflow verification: 154 passed tests,
  zero failures.
- Integrated second-wave focused verification: 6 files and 263 passed tests,
  zero failures.
- The combined controller, resolver, and workflow focused group passed from
  the main worktree with zero failures.
- Focused schema and restore verification: 8 passed tests, zero failures.
- Focused temporary-surface security verification: 8 passed tests, zero
  failures.
- Focused safe-tail verification: 28 passed tests, zero failures.
- TypeScript, documentation coverage, production build, repository security
  scan, security evidence, and the complete repository `check` pipeline all
  passed at the integrated implementation tip. Contract and Worker projects
  also passed independently while the one full-unit integration mismatch was
  diagnosed and corrected; the complete repository gate then passed.
- The backup key remains version 1 and was not rotated.

This final integration section and 77-path inventory supersede the earlier
five-commit wording. Final package re-review remains required before Task 3 is
accepted. Setback evidence remains separately controller-owned.
