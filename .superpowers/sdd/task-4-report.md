# Task 4 report

Status: accepted after final sanitized-package review.

Base: `2cf0ff1`.

No live provider, deployment, network, database, browser-account, Queue, R2,
or remote workflow action was performed. The backup key remains version 1 and
was not rotated.

## Delivered

- One canonical, frozen 30-minute AI evidence window is generated before
  observer dispatch and reused byte-for-byte by observer and candidate
  contexts. Exact-minute generation shifts the complete window by one
  millisecond; parser input is never repaired.
- The window enforces strict activation/evidence/expiry ordering, one Chicago
  accounting month, a 90-second live-request margin, and half-open rollback
  protection around quarter-hour and daily permanent schedules.
- Only canonical `deploy_ai` carries the verified zero-active gate plus exact
  scheduled time and expiry. Only `ai_succeeded` observe context carries the
  same timing pair. Every other context rejects those fields, and the workflow
  still exposes exactly three dispatch inputs.
- Only the `ai_usage` generated Worker candidate carries the scheduled-time
  binding. Environment validation requires it exactly for that candidate, and
  the client boundary classifies it as forbidden.
- The owner-bound AI usage source now provides one owner-wide, cross-month
  active-request snapshot and one atomic candidate created/eligible snapshot.
  Both reuse exact current-row/ledger lifecycle validation, safe integer
  decoding, and aggregate-only results.
- Authenticated preview diagnostics construct the aggregate source only after
  session and owner admission. Normal preview emits active count with null
  candidate fields; the AI candidate emits active, created, eligible, and the
  canonical scheduled instant. Production omits the temporary shape.
- New AI candidates use exact candidate intent v3 so the scheduled binding is
  immutable through provider-state verification. Historical v1/v2 artifacts
  remain accepted with their original exact schemas; non-AI candidates remain
  exact v2; mutation, restore, and closure proof versions are unchanged.
- Permanent cleanup inventory and subprocess-test timing were synchronized
  with the new temporary references and complete-suite load.

## TDD evidence

- Data lane RED: 14 intended missing-method failures and 16 existing passes.
  GREEN after review regressions: 37 of 37.
- Diagnostics lane RED: 2 intended unit/security failures, 8 intended Worker
  failures, and 1 intended browser failure. GREEN: 68 unit/security, 33 Worker,
  and 25 browser tests.
- Workflow/window lane RED: 9 intended failures and 192 passes. Initial GREEN:
  201 of 201; the combined original Task 4 scope collected all 8 requested
  files and passed 340 tests.
- Rollback-intent scope RED: 3 intended failures and 50 passes. GREEN: 53 of
  53. Independent compatibility RED: 2 failures and 25 passes; GREEN: 27
  rollback tests and 104 direct provider-state tests.
- Independent workflow review fixes passed 91 tests; half-open schedule-boundary
  fixes passed 32 tests. Cleanup plus safe-tail integration passed 36 tests.
- Final compatibility RED proved that historical v1 AI provider verification
  admitted a missing gateway-limit attestation (27 passed, 1 failed). The
  restored v1 contract then passed all 28 focused lifecycle tests.

## Root verification

- Task 4 focused source/test scope: 10 files and 396 tests passed with empty
  captured stderr.
- Worker diagnostics: 33 of 33 passed. The known sandbox-limited static export
  advisory remained warning-only; optional Wrangler diagnostics were routed to
  a task-local location.
- Browser diagnostics: 25 of 25 passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd docs:check`: passed.
- `pnpm.cmd security:scan`: fresh release evidence and release scan passed.
- Final clean `pnpm.cmd check`: 96 unit/integration/security files passed and 1
  skipped, with 1,541 tests passed and 1 skipped; 14 contract files and 179
  tests passed; 7 Worker files and 110 tests passed; both production builds,
  documentation, fresh release evidence, and release security passed.
- Scoped `git diff --check`: passed. Standard Windows line-ending notices were
  advisory only.

## Independent review

- Aggregate review found no source defect and requested stronger atomicity,
  decoder, lifecycle-corruption, and dispatched-row regression tests; all were
  added and passed.
- Diagnostics review returned `NO_BLOCKERS`.
- Workflow review found type-level AI-field widening, incomplete hostile-input
  proof, non-exhaustive variant rejection, and boundary-test gaps; all were
  corrected and verified.
- Rollback review found a Critical historical-v2 provider-compatibility defect
  plus exact-v3 propagation gaps; version-aware provider matching and complete
  downstream compatibility tests corrected them before staging.
- Final full-package reviews returned `NO_BLOCKERS` for the aggregate/data,
  diagnostics/privacy, and workflow/window/rollback surfaces. The last review
  caught the historical v1 AI attestation regression; its focused re-review
  returned `NO_BLOCKERS` after the TDD repair.

## Scope expansion from the frozen Task 4 list

Accepted Task 3 hardening added an exact candidate-intent consumer after the
original Task 4 path list was written. The smallest compatibility repair added
the rollback lifecycle source, test, and references. Full-suite verification
also required the permanent cleanup inventory and a bounded timeout for the
existing subprocess-based safe-tail test. The acceptance-context test was
updated because it is the canonical type/exact-key contract. The listed
temporary-fault integration file was collected and passed unchanged.

## Exact implementation surface (41 paths)

- `.github/workflows/preview.yml`
- `src/domain/operations/temporary-preview-fault.ts`
- `src/server/env.ts`
- `src/server/client-binding-boundary.ts`
- `src/data/phase-b-ai-usage-source.ts`
- `src/server/api/diagnostic-routes.ts`
- `scripts/run-preview-acceptance-controller.ts`
- `scripts/prepare-preview-acceptance-deploy-config.ts`
- `scripts/validate-preview-deploy-config.ts`
- `scripts/validate-preview-rollback-lifecycle.ts`
- `tests/unit/scripts/preview-acceptance-window.test.ts`
- `tests/unit/scripts/preview-acceptance-context.test.ts`
- `tests/unit/scripts/preview-acceptance-controller.test.ts`
- `tests/unit/scripts/preview-rollback-lifecycle.test.ts`
- `tests/unit/scripts/print-safe-tail.test.ts`
- `tests/unit/server/wrangler-routing.test.ts`
- `tests/unit/server/env.test.ts`
- `tests/integration/data/phase-b-ai-usage-source.test.ts`
- `tests/security/secret-bundle.test.ts`
- `tests/security/temporary-surface-cleanup.test.ts`
- `tests/e2e/foundation-diagnostics.spec.ts`
- `tests/worker/diagnostics.test.ts`
- `tests/unit/ci/workflows.test.ts`
- `docs/reference/simple/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/simple/scripts/run-preview-acceptance-controller.md`
- `docs/reference/simple/scripts/validate-preview-deploy-config.md`
- `docs/reference/simple/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/simple/src/data/phase-b-ai-usage-source.md`
- `docs/reference/simple/src/domain/operations/temporary-preview-fault.md`
- `docs/reference/simple/src/server/api/diagnostic-routes.md`
- `docs/reference/simple/src/server/client-binding-boundary.md`
- `docs/reference/simple/src/server/env.md`
- `docs/reference/technical/scripts/prepare-preview-acceptance-deploy-config.md`
- `docs/reference/technical/scripts/run-preview-acceptance-controller.md`
- `docs/reference/technical/scripts/validate-preview-deploy-config.md`
- `docs/reference/technical/scripts/validate-preview-rollback-lifecycle.md`
- `docs/reference/technical/src/data/phase-b-ai-usage-source.md`
- `docs/reference/technical/src/domain/operations/temporary-preview-fault.md`
- `docs/reference/technical/src/server/api/diagnostic-routes.md`
- `docs/reference/technical/src/server/client-binding-boundary.md`
- `docs/reference/technical/src/server/env.md`

All `docs/operations/setbacks/**` paths remain separately controller-owned and
excluded from the implementation surface.
