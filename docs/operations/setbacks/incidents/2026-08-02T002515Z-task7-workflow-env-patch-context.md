# Task 7 workflow environment line matched an earlier job

- **Occurred:** 2026-08-02T00:25:15Z
- **Status:** closed
- **Closed:** 2026-08-02T00:25:59.7399688Z
- **Phase:** Phase B / tracked correlation repair / Task 7 proof-chain reachability GREEN
- **Category:** patch-context mismatch

## What happened

A patch added the `ROLLBACK_RUN_ID` environment binding to the first workflow block with a similar candidate/closure environment sequence instead of the intended `verify_cleanup` job. The combined validator and proof-download edits landed in the intended cleanup step.

The mismatch was found by a bounded source inspection before a GREEN claim or live execution.

## Impact

The cleanup step currently references an unset local environment name, while a normal deployment step has one unnecessary environment binding. No workflow ran and no provider or secret state changed.

## Corrective action

- Remove the accidental binding from the normal deployment job.
- Add the binding under the uniquely named `Verify rollback closure before provider cleanup` step.
- Rerun the focused graph test and inspect the exact job text.

## Prevention

When workflow jobs repeat similar environment sequences, anchor patches to the unique step name and verify both the intended and first matching blocks immediately afterward.

## Resolution evidence

The stray binding was removed from normal deployment, added beneath the uniquely named cleanup step, and the focused rollback-lifecycle graph test passed (1 passed, 35 skipped).
