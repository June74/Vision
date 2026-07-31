# Task 3 report

Status: decisive follow-up repaired and locally verified.

Commit sequence:

- base before Task 3: `24e959f`
- initial Task 3 controller commit: `38bed3e991d5`
- first acceptance-gap repair: `b1935577c211`
- final re-review repair: `841bc01b600e`
- final follow-up repair: `870de3980789`
- decisive boundary repair: this commit

The full package inventory below covers the complete
`24e959f..decisive-follow-up` range. The decisive-follow-up allowlist is listed
separately so its 13 paths can be compared exactly with the 74-path,
five-commit package.

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

## Complete five-commit package inventory (74)

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
