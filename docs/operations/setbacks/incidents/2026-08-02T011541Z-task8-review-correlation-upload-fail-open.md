# Task 8 exact-tip review found a fail-open correlation upload

- **Occurred:** 2026-08-02T01:15:41.2046793Z
- **Status:** closed
- **Phase:** Phase B / tracked correlation repair / Task 8 exact-tip review
- **Category:** Important workflow safety finding

## What happened

The exact-tip review found that the workflow's correlation-evidence upload did not require an error when the expected file is absent. The action's default warning behavior could let selection appear successful and leave later mutation jobs without the immutable correlation artifact required for recovery.

## Impact

No live dispatch or provider mutation occurred. The candidate cannot pass exact-tip admission until the upload fails closed and regression tests reject removal or weakening of that setting.

## Corrective action

- Add the upload action's explicit missing-file error policy.
- Add textual and parsed-workflow regression coverage.
- Rerun focused tests, typecheck, documentation, security, complete local checks as required, then freeze and obtain a fresh zero-finding review.

## Prevention

Every evidence upload that gates a downstream mutation must assert both its exact path and a fail-closed missing-file policy in workflow source and parsed-graph tests.

## Closure

The upload now fails when the correlation file is absent. Parsed-YAML and textual contracts reject removal or weakening of that policy; the focused RED isolated three expected assertions, the repair produced 40-of-40 GREEN, the seven-file integration set passed 294 tests, and type, documentation, security, and strict pre-cleanup gates all met their expected outcomes.
