# SB-20260731-145201-task3-final-package-review-blockers: Final package review found lifecycle blockers

- **Status:** closed
- **First observed:** 2026-07-31T14:52:01.4047691Z
- **Last observed:** 2026-07-31T19:47:32.5520638Z
- **Phase/task:** Phase B Task 3 final package re-review
- **Environment:** Independent sanitized package-only lifecycle review
- **Version/commit:** c58a75f

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
- 2026-07-31T16:49:21.2452535Z: The third package-review wave reported two
  Important candidate-lifecycle blockers so far. An intent may be opened before
  fallible pre-deploy work, but a deployment that never becomes live has no
  normal-state abort transition and cannot satisfy candidate-profile rollback.
  Separately, the normal deployment operation can bypass rollback proof while
  an intent is open, removing the candidate profile without closing the intent.
  Task 3 remains unaccepted pending the final reviewer and a coordinated
  test-first repair.
- 2026-07-31T16:50:22.2835097Z: The final observer reviewer added three
  Important findings. The valid restore path can exceed the 42-minute listener
  lifetime; the resolver masks backward raw provider uniqueness evidence with
  a maximum; and a queued run with fully active jobs/listeners can be accepted
  despite contradictory topology. The R2/restore security reviewer reported
  no blockers. The third-wave set is five Important findings requiring one
  coordinated test-first repair and another package review.
- 2026-07-31T17:01:33.6452020Z: Read-only timeout analysis added one Important
  contract finding. Restore requires 2,590 seconds, so the listener and job
  must increase to 44 and 46 minutes respectively; however maintenance accepts
  an unbounded future semantic instant, so no finite observer lifetime is safe
  until the controller ties that instant to the same listener envelope. The
  active repair set is now six Important findings.
- 2026-07-31T17:38:26.4927483Z: The fourth package timing review found one
  Important blocker so far. The 2,590-second restore derivation begins after
  observer dispatch returns, but the listener already runs during a dispatch
  that may consume 120 seconds. The true valid path is about 2,710 seconds, so
  a 44-minute listener can expire early. The repair must include dispatch time
  and add an advancing-clock full-dispatch regression.
- 2026-07-31T17:45:17.1307988Z: The fourth package wave completed with six
  unique Important findings. In addition to observer dispatch time, candidate
  validation omits temporary acceptance bindings; uncertain deployment cannot
  safely reconcile exact normal state; provider metadata incorrectly uses the
  millisecond local-proof grammar; mandatory fields were added incompatibly to
  `/v1` artifacts; and a prior closure is checked against a later deployment
  commit. One independent candidate-workflow reviewer reported no blockers.
  The full six-finding set requires another coordinated test-first repair.
- 2026-07-31T19:47:32.5520638Z: Closed after the full lifecycle/schema,
  timeout, binding, timestamp, compatibility, and commit-separation repairs
  passed complete verification and the final three-reviewer package returned
  no blockers.
