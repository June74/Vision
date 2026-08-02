# Task 7 review found cleanup graph test globally scoped

- **Occurred:** 2026-08-02T00:41:51Z
- **Status:** closed
- **Closed:** 2026-08-02T00:45:44.1312694Z
- **Phase:** Phase B / tracked correlation repair / Task 7 final integration review
- **Category:** graph-test reachability weakness
- **Review verdict:** FAIL
- **Severity counts:** Critical 0, Important 1, Minor 0

## What happened

The final read-only reviewer confirmed the repaired live cleanup chain, then found that the regression test retrieves the proof-chain and provider-cleanup steps from the entire workflow rather than the `verify_cleanup` job. The assertions would still pass if either step moved to another job, and the test did not prove proof validation executes first.

No files were changed by the reviewer and no live state was accessed.

## Impact

Task 7 remains unaccepted. The implementation is currently placed correctly, but the graph-level guard does not prevent a future reachability or ordering regression.

## Corrective action

- Add a focused RED showing the current global helper cannot prove job ownership.
- Extract both steps from the already-scoped cleanup job text.
- Assert the combined proof-chain step precedes provider cleanup.
- Rerun the complete Task 7 gates and one fresh exact-boundary review.

## Prevention

Workflow reachability tests must scope named steps to the owning job and assert mutation-sensitive ordering; global source presence is not graph proof.

## Resolution evidence

Both named steps are now extracted from the already-selected `verify_cleanup` job, their execution order is asserted, the focused and complete Task 7 suites passed, and the final integration re-review passed with zero findings.
