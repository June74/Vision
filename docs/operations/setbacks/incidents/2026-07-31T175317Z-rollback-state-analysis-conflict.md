# SB-20260731-175317-rollback-state-analysis-conflict: Contract analysis rejected a valid may-have-started normal state

- **Status:** closed
- **First observed:** 2026-07-31T17:53:17.5077186Z
- **Last observed:** 2026-07-31T17:53:17.5077186Z
- **Phase/task:** Phase B Task 3 fourth-wave lifecycle repair
- **Environment:** Independent read-only contract analysis
- **Version/commit:** c0c8876 plus in-progress lifecycle tests

## Symptom

The independent contract analysis proposed rejecting exact-normal provider state
when the durable mutation boundary says deployment may have started. That
conflicted with the confirmed workflow ordering: the boundary is uploaded
before deployment, so deployment can fail without changing provider state.

## Impact

If implemented, rollback could reject a legitimate interrupted deployment and
orphan its lifecycle. The conflict was caught and corrected before the
lifecycle implementation adopted it.

## Cause classification

- **Confirmed cause:** The analysis treated `may_have_started` as proof that a
  candidate deployment changed provider state, rather than proof that the
  deployment outcome is uncertain.
- **Hypotheses:** None remaining.
- **Known exclusions:** No provider or production state was inspected or
  changed, and the conflicting rule was not authorized for implementation.

## Correction and prevention

- **Correction:** For `may_have_started`, admit exact operation-specific
  candidate or exact normal state, then always execute immutable normal
  redeployment and fresh exact-normal verification before proof and closure.
  For `not_started`, admit exact normal only.
- **Prevention:** Derive admission states from the exact mutation-boundary
  placement and distinguish uncertainty from proof of mutation.
- **Owner:** Codex.
- **Next diagnostic step:** Prove both `may_have_started` admission paths and
  the strict downstream normal redeploy in tests.

## Recurrence history

- 2026-07-31T17:53:17.5077186Z: Conflict identified, rejected, and corrected
  before implementation.
