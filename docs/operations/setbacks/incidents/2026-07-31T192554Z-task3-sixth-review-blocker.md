# SB-20260731-192554-task3-sixth-review-blocker: Sixth Task 3 review found a v1 workflow recovery gap

- **Status:** open
- **First observed:** 2026-07-31T19:25:54.6019364Z
- **Last observed:** 2026-07-31T19:29:02.3220014Z
- **Phase/task:** Phase B Task 3 sixth sanitized package review
- **Environment:** Local read-only independent review
- **Version/commit:** sanitized package from 24e959f5 through 82b14f9

## Symptom

The classifier now correctly returns `may_have_started` for an exact v1 intent
with no v2-only mutation-boundary artifact. The workflow nevertheless treats
every `may_have_started` result as boundary-backed and tries to download and
verify that absent v2 artifact before provider admission.

The holistic reviewer also found that the 48-minute job timer begins before
checkout, runtime setup, and dependency installation, while the 46-minute
listener timer begins later. The literal two-minute difference therefore does
not guarantee two minutes for teardown. The workflow invariant also still
models 2,590 seconds instead of the controller's complete 2,710-second path.

## Impact

Valid v1 recovery remains unreachable in the workflow despite the corrected
classifier. A valid observer can also be terminated by the outer job before
its inner listener finishes. Task 3 stays unaccepted. No provider, network,
environment, secret, staging, or external mutation occurred during review.

## Cause classification

- **Confirmed cause:** The workflow branches only on mutation state and does
  not also distinguish conservative v1 uncertainty from v2 boundary-backed
  uncertainty.
- **Confirmed cause:** The workflow timeout test subtracts two configured
  literals but does not include bounded pre-listener setup time, and it retains
  the prior 2,590-second duration model.
- **Hypotheses:** The outer job can be enlarged safely only if the complete
  pre-listener path also has explicit bounded allowances.
- **Known exclusions:** The shell-free supervisor, expiry round-trip, report
  consolidation, and 78-path inventory passed sixth review.

## Correction and prevention

- **Correction:** Carry or derive the exact intent version into the rollback
  branch. Skip v2 mutation-boundary download only for exact v1 conservative
  uncertainty; retain mandatory exact boundary download/verification for v2
  `may_have_started`. Both flows must continue through provider admission,
  immutable-normal redeploy, fresh exact-normal verification, proof, and
  closure.
- **Correction:** Use the controller's 2,710-second conservative envelope in
  workflow tests and give the job a provable bounded setup allowance plus
  teardown margin beyond the 46-minute inner listener.
- **Prevention:** Treat mutation state and evidence schema version as a joint
  workflow state, with explicit tests for every reachable pair.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Add RED workflow assertions for v1 zero-artifact
  recovery and v2 boundary-backed verification.

## Recurrence history

- 2026-07-31T19:25:54.6019364Z: Sixth-review blocker durably recorded while
  the holistic review remained in progress.
- 2026-07-31T19:29:02.3220014Z: Holistic review completed and added the outer
  job/setup-margin and stale 2,590-second invariant finding.
