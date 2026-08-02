# Task 7 Task 6 discovery-window fix failed

- **Occurred:** 2026-08-01T23:11:39.3257884Z
- **Status:** closed
- **Resolved:** 2026-08-01T23:20:59.8556665Z
- **Phase:** Phase B / tracked correlation repair / Task 6 GREEN repair
- **Category:** rejected timing hypothesis
- **Related:** SB-20260801-225050, SB-20260801-230137

## What happened

After all temporary diagnostic markers were removed, the self-test received longer named request-discovery and contained-child deadline bounds. The required full rerun still ended at 53 assertions with four failures confined to exact sync and AI approval success, lease validation, and harness completion.

The syntax and privacy gates did not run because the harness was nonzero. No sensitive state was inspected or emitted, the default control root was not touched, and no live/provider operation occurred.

## Impact

The short discovery-window explanation is rejected as sufficient. Task 6 remains unaccepted, and further timing changes would be speculative without a direct source-level lifecycle proof.

## Next diagnostic

Pause timing experiments. Perform a root-agent bounded source review of the self-test responder, driver approval polling loop, atomic claim/read path, and child finalization. Compare their exact control flow and deadlines statically before changing either file. Then construct the smallest deterministic reproduction of the failing approval-success path.

## Prevention

A diagnostic timing correlation is not a root cause unless changing only that bound reliably changes the downstream state transition. Escalate repeated failed hypotheses to a fresh static call-path review before another implementation experiment.

## Resolution

Fresh static call-path review identified immediate harness-side child termination as the causal defect. Normal response paths now await natural child completion; only the explicit missing-control case terminates a pending child. The longer bounded Windows timing margins remain containment-only robustness bounds and are not treated as the root-cause fix.
