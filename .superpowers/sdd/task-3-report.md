# Task 3 report

Status: repaired and locally verified from base `38bed3e991d5`.

## RED, GREEN, and refactor evidence

- Consolidated RED: the five targeted review suites reported 14 failures and
  115 passes (129 tests). The failures reproduced the disconnected observer
  executable, incomplete controller, provider/lifecycle gaps, broad R2
  metadata, and workflow mapping defects.
- Controller boundary RED: after adding real subprocess and entrypoint
  assertions, 3 of 19 controller tests failed until the in-process opaque
  observer port and closed action/closure protocol replaced serialized handles.
- Scheduled-candidate RED: 1 of 19 controller tests proved that a scheduled
  foundation candidate incorrectly requested approval instead of using
  provider-confirmed deployment completion.
- GREEN: the exact frozen 19-file Task 3 command passes 19 files and 435 tests.
  The focused controller passes 19 of 19 tests, and the workflow structure
  suite passes 20 of 20 tests.
- Refactor: observer jobs now share one exact family/job contract; every tail
  mode uses strict semantic arguments and true close behavior; controller
  child processes use captured argument arrays and one constant error;
  observer handles remain in a process-local opaque map; lifecycle artifacts
  derive operation/profile transitions; provider checks derive their profile
  from validated artifacts; and restore receives only the read catalog plus
  its one-shot fence.

## Delivered

- Observer-first dispatch, immutable reviewed-commit checks, exact attribution,
  five-second polling, action-completion no-signal timing, immediate rollback,
  signed-in closure, and scheduled-candidate deployment confirmation.
- Family-exact signal/uniqueness workflows with expectation, close instant,
  maintenance tick, upstream failure propagation, and no persisted observer
  identifier.
- Current-workflow role-probe and replay-fenced restore routing, production
  read-only restore construction, restore-pair provider validation, and closed
  role-to-restore-to-cleanup lifecycle transitions.
- Exact R2 backup metadata reconstruction without write/delete capability.
- Maintenance evidence `vision.calendar-maintenance/v2`, with the exact
  six-key schema and canonical scheduled-event attribution.
- Mirrored simple/technical references and a name-only secret lifecycle note.
  The backup key was not changed or rotated; required key version remains `1`.

## Verification

- Exact Task 3 suite: 19 files, 435 tests passed.
- Controller suite: 19 tests passed.
- Workflow structure suite: 20 tests passed.
- `pnpm.cmd typecheck`: passed after the final comment-only documentation edits.
- `pnpm.cmd docs:check`: passed.
- `pnpm.cmd security:scan`: passed with fresh release evidence.
- No live provider, deployment, database, R2, Queue, browser, remote query,
  push, or other remote mutation was performed.

## Exact staged paths

- `.github/workflows/preview.yml`
- `.superpowers/sdd/task-3-report.md`
- `docs/operations/secrets.md`
- `docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/simple/scripts/print-safe-tail.md`
- `docs/reference/simple/scripts/resolve-preview-observer-run.md`
- `docs/reference/simple/scripts/run-preview-acceptance-controller.md`
- `docs/reference/simple/scripts/validate-preview-deploy-config.md`
- `docs/reference/simple/scripts/validate-preview-observer-state.md`
- `docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/simple/src/data/backup/r2-backup-object-reader.md`
- `docs/reference/simple/src/jobs/calendar-maintenance-evidence.md`
- `docs/reference/simple/src/jobs/scheduled.md`
- `docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/technical/scripts/print-safe-tail.md`
- `docs/reference/technical/scripts/resolve-preview-observer-run.md`
- `docs/reference/technical/scripts/run-preview-acceptance-controller.md`
- `docs/reference/technical/scripts/validate-preview-deploy-config.md`
- `docs/reference/technical/scripts/validate-preview-observer-state.md`
- `docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/technical/src/data/backup/r2-backup-object-reader.md`
- `docs/reference/technical/src/jobs/calendar-maintenance-evidence.md`
- `docs/reference/technical/src/jobs/scheduled.md`
- `scripts/prepare-preview-acceptance-deploy-config.ts`
- `scripts/print-safe-tail.ts`
- `scripts/resolve-preview-observer-run.ts`
- `scripts/run-preview-acceptance-controller.ts`
- `scripts/validate-preview-deploy-config.ts`
- `scripts/validate-preview-observer-state.ts`
- `scripts/validate-preview-rollback-lifecycle.ts`
- `src/data/backup/r2-backup-object-reader.ts`
- `src/jobs/scheduled.ts`
- `src/jobs/temporary-preview-restore-production.ts`
- `tests/integration/backup/r2-backup-object-reader.test.ts`
- `tests/integration/jobs/temporary-preview-acceptance-routing.test.ts`
- `tests/unit/ci/workflows.test.ts`
- `tests/unit/scripts/preview-acceptance-controller.test.ts`
- `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- `tests/unit/scripts/preview-observer-state.test.ts`
- `tests/unit/scripts/preview-rollback-lifecycle.test.ts`
- `tests/unit/scripts/print-safe-tail.test.ts`
- `tests/unit/server/wrangler-routing.test.ts`

All `docs/operations/setbacks/**` paths remain controller-owned and excluded
from this implementation commit.
