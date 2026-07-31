# SB-20260731-145201-task3-final-package-review-blockers: Final package review found lifecycle blockers

- **Status:** contained
- **First observed:** 2026-07-31T14:52:01.4047691Z
- **Last observed:** 2026-07-31T15:52:55.5251629Z
- **Phase/task:** Phase B Task 3 final package re-review
- **Environment:** Independent sanitized package-only lifecycle review
- **Version/commit:** 2a2b5f9

## Symptom

The first fresh reviewer reported three Important findings in the integrated
Task 3 package: an aborted provider command may remain unsettled; rollback
settlement, closure dispatch, and closure verification share one depleting
cleanup deadline; and a no-evidence path can synthesize a provider-attributed
uniqueness close from local wall time.

## Impact

Task 3 is not accepted and Task 4 implementation must not begin. The reviewed
package and prior GREEN checks are insufficient because the uncovered
lifecycle paths are not fully enforced by existing tests.

## Reproduction conditions

Review the complete sanitized 75-path package against abort-settlement, fresh
post-stage deadline, and provider-evidence attribution invariants.

## Safe evidence

The reviewer returned three severity-ranked findings with function-level
locations. No source block, raw value, URI, credential, protected identifier,
provider value, runtime stream, or environment value was reproduced.

## Attempts and outcomes

- The canonical local gate and focused suites were GREEN.
- Fresh package review still found three Important contract gaps.
- The independent workflow reviewer added two Critical findings and one
  Important finding: equal outer/inner 120-second resolution budgets can make
  real-clock success impossible; workflow settlement/closure inherits an
  unrelated 120-second cap; and a future uniqueness completion timestamp can
  pass the simultaneous-success path.
- The independent security reviewer added two Important findings: uncertain
  rollback dispatch is not reconciled before the rollback latch suppresses
  further cleanup, and provider-controlled restore input lacks fixed object
  body, pagination, and total-candidate bounds.
- No repair, staging, commit, provider action, or external mutation has begun.

## Cause classification

- **Confirmed cause:** The production contracts still permit unsettled abort,
  shared exhausted closure timing, and locally fabricated close evidence.
- **Hypotheses:** Exact repair shape remains to be validated with RED tests.
- **Rejected hypotheses:** Passing existing tests does not prove these paths.
- **Known exclusions:** No credential, provider, backup-key, or live state is
  involved.

## Correction and prevention

- **Correction:** Add focused RED cases for all three findings, implement
  abort-and-join, fresh per-stage bounded deadlines, and evidence-only close
  attribution, then rerun all Task 3 gates and a new package review wave.
- **Prevention:** Require adversarial package review after final integration;
  do not accept a locally fabricated timestamp as provider evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Wait for the remaining two reviewers, merge any
  nonduplicate findings, then repair the complete finding set test-first.

## Verification and related work

Pending.

## Recurrence history

- 2026-07-31T14:52:01.4047691Z: First observed and contained before any repair
  or downstream Task 4 work.
- 2026-07-31T14:53:20.7611207Z: Workflow review added two Critical and one
  Important finding. The finding set now also requires real advancing-clock
  coverage, workflow-aware settlement/closure budgets, and paired-read future
  uniqueness rejection.
- 2026-07-31T14:56:48.2972062Z: Security review added rollback-dispatch
  reconciliation and bounded restore object/body/page requirements. The full
  three-reviewer finding set is now available for one coordinated TDD repair.
- 2026-07-31T15:52:04.9197522Z: The second fresh package-review wave found one
  Critical and three Important blockers so far. A fresh observer can be
  rejected while its listener job is still starting; configured observer
  lifetime cannot cover the valid candidate window; a legitimate later
  provider completion can advance the cached uniqueness close while the
  controller wrongly requires equality; and contradictory R2 pagination
  metadata can be treated as a complete catalog. The package remains
  unaccepted and Task 4 source work remains barred pending the third review
  and one coordinated test-first repair.
- 2026-07-31T15:52:55.5251629Z: The lifecycle review completed and added one
  Critical rollback blocker: candidate-state verification incorrectly expects
  the permanent schedule profile for five candidate operations that require
  the temporary one-minute schedule, so rollback can stop before restoring the
  normal preview. Its R2 pagination finding duplicates the security review.
  The deduplicated second-wave set is two Critical and three Important
  blockers across workflow startup/lifetime/uniqueness, candidate rollback
  validation, and R2 pagination-envelope validation.
