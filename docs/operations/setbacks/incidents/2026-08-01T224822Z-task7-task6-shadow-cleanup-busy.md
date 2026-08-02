# Task 7 Task 6 shadow cleanup remained busy

- **Occurred:** 2026-08-01T22:48:22.5495214Z
- **Status:** closed
- **Resolved:** 2026-08-01T23:20:59.8556665Z
- **Phase:** Phase B / tracked correlation repair / Task 6 GREEN
- **Category:** contained test-harness resource lifecycle

## What happened

The first Task 6 GREEN attempt stopped during final cleanup because Windows reported that the disposable test shadow directory was still in use.

The harness did not emit raw child output or sensitive values. It made no live/provider, network, deployment, database, calendar, authentication, secret, or key operation, and it did not touch the preexisting default control root.

## Impact

The Task 6 GREEN result is not accepted. The implementation and its 86-assertion harness remain unverified until the child-process lifecycle and cleanup ordering are corrected and the complete self-test passes.

## Root cause

Not yet established. The leading bounded hypothesis is that a disposable child process or one of its inherited handles had not fully closed before recursive removal began.

## Next diagnostic

Inspect only the local child-process wait, termination, stream-close, and final-cleanup sequence. Identify the exact lifecycle gap before editing, add or preserve a regression assertion where feasible, then rerun the complete contained harness.

## Diagnostic update

At 2026-08-01T22:50:50.5454179Z, an instrumented contained rerun observed every harness-owned control-child close event before cleanup, and the busy-directory symptom did not recur. This run does not support attributing the first failure to an unawaited owned control child. The incident stays open until repeated clean completion or a more exact cause closes it.

A later diagnostic aborted early with one harness-owned control child still awaiting close. Because that run did not reach its normal wait/finally sequence, it is tracked as a separate harness-abort setback and does not establish the cause of the original cleanup symptom.

## Prevention

Disposable process tests must await child exit and close inherited streams or handles before attempting recursive cleanup; Windows cleanup timing must be treated as an explicit lifecycle boundary.

## Resolution

The self-test now unconditionally terminates any remaining owned child in `finally`, awaits callback completion and close for every owned child, and only then removes its temporary root. Multiple later full runs cleaned successfully and the busy-directory symptom did not recur.
