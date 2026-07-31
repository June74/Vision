# SB-20260731-161234-resolver-skipped-duplicate-regression: Resolver rejected a valid active job beside a skipped duplicate

- **Status:** closed
- **First observed:** 2026-07-31T16:12:34.6805638Z
- **Last observed:** 2026-07-31T16:17:56.4875463Z
- **Phase/task:** Phase B Task 3 workflow blocker repair
- **Environment:** Focused local resolver/controller/workflow tests
- **Version/commit:** 6dfdd38 plus unstaged repair

## Symptom

The first resolver condition for expected-but-skipped jobs also rejected a
completed skipped duplicate when the exact expected active job existed,
breaking three established tests and leaving 151 of 154 passing.

## Impact

The regression was contained by focused tests and was never integrated or
deployed. No provider, network, secret, protected output, or external mutation
occurred.

## Cause classification

- **Confirmed cause:** The condition classified any expected skipped job as
  contradictory instead of first checking for an exact active non-skipped
  counterpart.
- **Hypotheses:** None remaining.
- **Known exclusions:** The intended new expected-skipped RED case was covered.

## Correction and prevention

- **Correction:** Treat expected skipped topology as contradictory only when
  no valid active non-skipped counterpart exists; retain exact-one-active-job
  enforcement.
- **Prevention:** Preserve duplicate/skipped established cases in every
  topology-hardening change.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the identical 154-test scope after narrowing
  the condition.

## Recurrence history

- 2026-07-31T16:12:34.6805638Z: First observed and contained by focused tests.
- 2026-07-31T16:17:56.4875463Z: Closed after the narrowed topology rule
  restored the established duplicate cases and all 154 focused tests passed.
