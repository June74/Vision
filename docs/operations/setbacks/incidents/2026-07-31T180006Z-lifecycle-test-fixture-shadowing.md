# SB-20260731-180006-lifecycle-test-fixture-shadowing: Lifecycle test loop shadowed its fixture helper

- **Status:** closed
- **First observed:** 2026-07-31T18:00:06.9471204Z
- **Last observed:** 2026-07-31T18:00:06.9471204Z
- **Phase/task:** Phase B Task 3 fourth-wave lifecycle repair
- **Environment:** Local focused unit test
- **Version/commit:** e9e8934 plus in-progress lifecycle edits

## Symptom

While converting a stale provider-state fixture from v1 to v2, a loop variable
reused the fixture helper's name and caused a temporal-dead-zone `ReferenceError`
before assertions ran.

## Impact

The focused test stopped before validating the intended provider inventory.
The error is local and test-only; no provider, environment, network, secret,
staging, or commit was touched.

## Cause classification

- **Confirmed cause:** The loop variable shadowed the fixture-construction
  helper in the same block.
- **Hypotheses:** None remaining.
- **Known exclusions:** This is not a production lifecycle or provider-state
  failure.

## Correction and prevention

- **Correction:** Rename the loop variable and rerun the exact focused test.
- **Prevention:** Use distinct semantic names for fixture factories and
  iteration values in table-driven tests.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correction is exact.

## Recurrence history

- 2026-07-31T18:00:06.9471204Z: Observed, contained, and closed before any
  external action.
