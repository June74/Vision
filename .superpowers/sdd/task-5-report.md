# Task 5 report

Status: accepted after final full-repository gate and independent re-review.

Base: `7e95b61`.

No live provider, deployment, network, database, browser-account, Queue, R2,
remote workflow, or remote Git action was performed. No secret-bearing value,
request body, event identity, response body, provider identifier, or account
data was read or emitted. The backup key remains version 1 and was not rotated.

## Delivered

- The scheduled AI evidence job consumes Task 4's exact candidate counts. It
  waits without downstream evidence reads for `0/0` and `1/0`, emits only for
  `1/1`, and fails closed for impossible or greater-than-one relationships.
  Duplicate delivery of the exact eligible scheduled event may emit twice so
  observer uniqueness, not the emitter, owns duplicate rejection.
- The temporary one-minute branch compares the scheduled event to the exact AI
  evidence instant before generic lifetime validation or database dependency
  construction. Earlier and later ticks return. The exact tick must still be
  before expiry and outside protected permanent windows. Quarter-hour calendar
  maintenance and daily recovery retain their prior ordering and behavior.
- AI observation now uses concurrent output-free signal and uniqueness jobs.
  Signal state is read only through allowlisted job state and completion time.
  Uniqueness holds the first exact terminal through `expiresAt + 3 minutes` and
  rejects zero, duplicate, mixed, malformed, late, failure, premature stream
  completion, and derived-date overflow cases.
- Workflow ceilings are 63 minutes for the AI tail and 65 minutes for the job.
  The controller polls every five seconds, uses the earliest admitted rollback
  deadline, rolls back at actual expiry when no signal succeeds, and never
  leaves the candidate deployed beyond expiry while uniqueness completes.
- The page-context browser helper invokes the private request factory and
  `fetch` exactly once, starts a 35-second monotonic abort, drains and discards
  response bytes, clears the timer, never retries, and returns only canonical
  safe timestamps, one Boolean, and the five-value status class. Fractional
  browser clocks are admitted; abort classification takes precedence over a
  later fulfilled response.
- The existing Worker AI route contract remains unchanged and was reverified:
  private session, anti-forgery state, event reference, idempotency input,
  route input, request body, and server-built provider input never enter the
  helper's result or logs.

## TDD evidence

- Scheduled count gate RED: 11 expected failures. Scheduled-order RED: 6
  expected failures. GREEN: 3 integration files and 66 tests passed.
- Browser helper initial GREEN: 12 tests. Independent review RED: exactly 2
  failures reproduced fractional-clock rejection and fulfilled-after-abort
  false success. Repair GREEN: all 14 browser-helper tests passed.
- Observer/workflow GREEN: 5 files and 220 tests. Derived uniqueness-close
  overflow was added as RED and repaired fail-closed.
- Controller maximum-expiry RED: 1 failed with 62 skipped because remote-tip
  checks occurred before rejection. Repair GREEN: the targeted test passed and
  the complete controller file passed all 63 tests.

## Verification

- Frozen Task 5 unit/integration command: 9 files and 300 tests passed,
  including every named integration path under the unit project.
- Frozen Worker command: 1 file and 11 tests passed. The known sandbox-only
  Wrangler log and static export-analysis advisories remained warning-only.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd docs:check`: passed.
- `pnpm.cmd build`: both production builds passed.
- `pnpm.cmd security:scan`: fresh release evidence and release security scan
  passed.
- Scoped `git diff --check`: passed; standard Windows line-ending notices are
  advisory only.
- Final clean `pnpm.cmd check`: 97 unit/integration/security files passed and 1
  skipped, with 1,582 tests passed and 1 skipped; 14 contract files and 179
  tests passed; 7 Worker files and 110 tests passed; both production builds,
  documentation, fresh release evidence, and release security passed.

## Independent review

- Browser privacy/timing review found two Important timing defects. Both were
  reproduced with RED tests, repaired, and re-reviewed `NO_BLOCKERS`.
- Scheduled SQL-gate and ordering review returned `NO_BLOCKERS`.
- Observer/workflow review found controller derived-date overflow and three
  stale semantic reference statements. The overflow was reproduced and moved
  ahead of dependencies; references were corrected; focused re-review returned
  `NO_BLOCKERS`.

## Exact implementation surface (30 paths)

- `.github/workflows/preview.yml`
- `src/jobs/phase-b-ai-usage-evidence.ts`
- `src/jobs/scheduled.ts`
- `scripts/print-safe-tail.ts`
- `scripts/resolve-preview-observer-run.ts`
- `scripts/run-preview-acceptance-controller.ts`
- `scripts/validate-preview-ai-browser-request.ts`
- `tests/integration/jobs/phase-b-ai-usage-evidence.test.ts`
- `tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts`
- `tests/integration/jobs/temporary-preview-fault.test.ts`
- `tests/unit/scripts/preview-observer-run-resolution.test.ts`
- `tests/unit/scripts/preview-acceptance-controller.test.ts`
- `tests/unit/scripts/preview-observer-state.test.ts`
- `tests/unit/scripts/print-safe-tail.test.ts`
- `tests/unit/scripts/preview-ai-browser-request.test.ts`
- `tests/unit/ci/workflows.test.ts`
- `docs/reference/simple/scripts/print-safe-tail.md`
- `docs/reference/simple/scripts/resolve-preview-observer-run.md`
- `docs/reference/simple/scripts/run-preview-acceptance-controller.md`
- `docs/reference/simple/scripts/validate-preview-ai-browser-request.md`
- `docs/reference/simple/scripts/validate-preview-observer-state.md`
- `docs/reference/simple/src/jobs/phase-b-ai-usage-evidence.md`
- `docs/reference/simple/src/jobs/scheduled.md`
- `docs/reference/technical/scripts/print-safe-tail.md`
- `docs/reference/technical/scripts/resolve-preview-observer-run.md`
- `docs/reference/technical/scripts/run-preview-acceptance-controller.md`
- `docs/reference/technical/scripts/validate-preview-ai-browser-request.md`
- `docs/reference/technical/scripts/validate-preview-observer-state.md`
- `docs/reference/technical/src/jobs/phase-b-ai-usage-evidence.md`
- `docs/reference/technical/src/jobs/scheduled.md`

The brief-listed `scripts/validate-preview-observer-state.ts` and
`tests/worker/ai-category-proposals.test.ts` were verified without a text
change. All setback-ledger paths remain separately controller-owned and are
excluded from the implementation commit.
