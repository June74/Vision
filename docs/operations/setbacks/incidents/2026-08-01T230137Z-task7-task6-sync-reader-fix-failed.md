# Task 7 Task 6 synchronous reader fix failed

- **Occurred:** 2026-08-01T23:01:37.9556295Z
- **Status:** closed
- **Resolved:** 2026-08-01T23:20:59.8556665Z
- **Phase:** Phase B / tracked correlation repair / Task 6 GREEN repair
- **Category:** rejected implementation hypothesis
- **Related:** SB-20260801-225050, SB-20260801-225223

## What happened

The accepted minimal experiment replaced the claimed-response reader with a bounded synchronous single-descriptor open/stat/read/close sequence. The next contained run did not reach GREEN: it ended at 53 assertions with five failures, including shared approval-success and lease categories, a harness category, and one adversarial predating-response category.

All inherited assertions reached before the abort remained green. No syntax or privacy gate was run because the complete harness was nonzero. No sensitive value was inspected or emitted, the default control root was not touched, and no live/provider operation occurred.

## Impact

The synchronous-reader explanation is rejected as sufficient. Task 6 remains blocked at local implementation verification, and the attempted reader change must not be accepted merely because it preserves the intended shape.

## Next diagnostic

Keep the full run non-short-circuiting so every named category reports a bounded result. Compare only categorical timing and lifecycle transitions around request creation, response claim, response read completion, and lease creation. Determine whether the contained responder lifecycle or test deadline—not the file API—is preventing completion. Revert or retain the reader only based on demonstrated contract behavior, then rerun all 86 assertions.

## Prevention

Do not infer root cause solely from the last observed boundary. Require a controlled experiment that changes that boundary and produces the expected downstream transition before accepting the explanation.

## Resolution

The synchronous-reader experiment was fully reverted. Static tracing established that the reader was not causal: the self-test killed the driver before it could consume the response. The corrected harness passed all 86 assertions with the original asynchronous one-handle reader intact.
