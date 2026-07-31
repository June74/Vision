# Task 3 report

Status: sixth package-review repairs locally verified; final sanitized-package
re-review pending.

Commit sequence:

- base before Task 3: `24e959f`
- initial Task 3 controller commit: `38bed3e991d5`
- first acceptance-gap repair: `b1935577c211`
- final re-review repair: `841bc01b600e`
- final follow-up repair: `870de3980789`
- decisive boundary repair: `2bfbc23f13c`
- final lifecycle integration: `b4f6dce`
- final package-review repair: `328b748`
- second package-review repair: `d6a6432`
- third package-review repair: `f37fb4c`
- fourth timing-envelope repair: `e9e8934`
- fourth lifecycle/schema repair: `25830ea`
- fifth package-review repair: `8ea5540`
- sixth package-review repair: `68caff9`

The full inventory below is the exact 78-path Task 3 implementation and
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

- All seven acceptance jobs bound checkout, commit verification, pnpm setup,
  Node setup, and locked install to 2, 1, 2, 2, and 5 minutes respectively,
  followed by a 46-minute listener/supervisor inside a 60-minute job.
  Parsed-workflow tests prove the 12-minute setup allowance, 2,710-second
  restore path, 50-second listener slack, and two-minute teardown reserve.
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

- Sixth-review combined focused suite: 7 files and 223 tests passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd docs:check`: passed.
- Complete repository gate: 96 unit files passed and 1 skipped with 1,490
  tests passed and 1 skipped; 14 contract files and 179 tests passed; 7 Worker
  files and 106 tests passed.
- Production worker/client build, fresh release evidence, and release security
  scan passed. The authoritative Windows check used `cmd.exe` only as the local
  test-runner wrapper so optional Wrangler debug-log warnings could not replace
  the actual `pnpm` child exit code, which was 0. Vision's supervisor itself
  uses no command shell.
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

## Complete final package inventory (78)

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
- `tests/unit/ci/workflow-yaml.test.ts`
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

## Current canonical integration

- Review base: `24e959f5`.
- Latest implementation commit: `68caff9`.
- Integrated shape: 17 implementation commits and exactly 78 changed paths.
- All seven acceptance jobs reserve an explicitly bounded 12-minute setup
  allowance before a 46-minute listener/supervisor inside a 60-minute job. The
  complete restore evidence path is 2,710 seconds, leaving 50 seconds inside
  the listener and a tested two-minute teardown reserve after setup and
  listener bounds.
- New v2 candidate intents bind exact operation-specific provider
  configuration and the v2 mutation-boundary artifact. Valid v1 intents follow
  an explicit workflow branch that does not download or verify that nonexistent
  v2-only artifact, classifies zero-artifact state as `may_have_started`, and
  admits only exact normal or exact allowlisted legacy candidate state. V2
  zero-artifact state remains `not_started`; mixed-version evidence fails
  closed.
- `may_have_started` admits only exact normal or the exact known candidate
  provider state, then unconditionally redeploys immutable normal, freshly
  verifies exact normal, and only then writes proof and closure.
- Legacy candidate expiry requires a finite parse and byte-for-byte canonical
  UTC millisecond round-trip; provider metadata and local-proof timestamp
  grammars remain distinct.
- The default supervisor launches installed Wrangler and tsx JavaScript
  entrypoints through `process.execPath`, absolute entrypoint paths, fixed
  argument arrays, and `shell: false`; it no longer relies on Windows command
  scripts or wrapper-process teardown.
- The current focused and complete verification results are recorded once in
  the Verification section above.
- Six independent review waves have completed. The sixth reported two
  Important blockers: the v1 workflow's attempted v2-only artifact download
  and the unproven observer job-timeout envelope. Both have RED evidence and
  implemented repairs. A final sanitized-package re-review is required before
  Task 3 is accepted.
- The backup key remains version 1 and was not rotated.

This canonical section and the 78-path inventory supersede earlier integration
wording. Setback evidence remains separately controller-owned.
