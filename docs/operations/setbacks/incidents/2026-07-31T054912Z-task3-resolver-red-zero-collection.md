# SB-20260731-054912-task3-resolver-red-zero-collection: Resolver RED run collected zero assertions

- **Status:** closed
- **First observed:** 2026-07-31T05:49:12.7453226Z
- **Last observed:** 2026-07-31T05:52:51.6453196Z
- **Phase/task:** Phase B Task 3 resolver final-review repair
- **Environment:** Main Phase B worktree; focused in-memory Vitest reporting
- **Version/commit:** c5de12d plus four intended resolver boundary RED cases

## Symptom

Vitest exited nonzero but its in-memory JSON report contained zero collected
assertions, so the run did not prove the four intended RED behaviors.

## Impact

Resolver production and documentation remain untouched. Only the owned resolver
test file contains the intended four RED cases, and implementation cannot begin
until collection is repaired.

## Reproduction conditions

Run the modified focused resolver test file when a collection-time or
reporting-time problem prevents assertion execution.

## Safe evidence

The writer reported one collection/reporting failure category and zero
assertions. It emitted no raw test stream, source payload, URI, credential,
protected identifier, provider value, argument list, or environment value.

## Attempts and outcomes

- Four intended boundary RED cases were added to the owned test file.
- The focused run exited before collecting any assertion.
- No production, documentation, Git, provider, or external state changed.

## Cause classification

- **Confirmed cause:** None yet beyond a pre-assertion collection/reporting
  failure.
- **Hypotheses:** A test syntax/import/type shape or reporter parse problem
  prevented collection.
- **Rejected hypotheses:** This is not valid intended RED evidence.
- **Known exclusions:** Resolver production code is unchanged.

## Correction and prevention

- **Correction:** Classify syntax/import/reporter category without raw output,
  repair only the test harness, then rerun and require the intended four RED
  assertions.
- **Prevention:** Require nonzero collected assertion counts before accepting
  any focused RED result.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Bounded local compiler/runner diagnosis repaired the test harness. All four
intended boundary assertions then collected and failed, with zero unexpected
RED failures.

## Recurrence history

- 2026-07-31T05:49:12.7453226Z: First observed and contained with resolver
  production unchanged.
- 2026-07-31T05:52:51.6453196Z: Closed after the focused run produced four
  valid intended RED failures.
