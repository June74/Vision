# Task 7 direct-evidence delay counter collision

- **Occurred:** 2026-08-02T00:02:20.9471443Z
- **Status:** closed
- **Resolved:** 2026-08-02T00:12:17.6710563Z
- **Phase:** Phase B / tracked correlation repair / Task 7 direct-evidence GREEN
- **Category:** contained self-test isolation regression
- **Related:** SB-20260801-235809

## What happened

The first GREEN after adding direct correlation verification passed 91 of 92 assertions. The sole failure was the previously accepted delayed-reconciliation category; every new direct-evidence category passed.

The leading bounded hypothesis is that the new delayed direct test and the older delayed reconciliation test reuse one stub scenario and its root-global attempt counter, so the later test no longer observes its own first unavailable artifact attempt.

No syntax failure, sensitive output, or live/provider action occurred.

## Impact

The 92-assertion suite is not accepted. Delayed direct and delayed reconciliation evidence must be isolated so both independently prove a retry without redispatch.

## Next diagnostic

Inspect only the contained stub's delay counter keys and the two scenario names. Confirm shared-state reuse, then assign distinct scenario-specific counters without changing production behavior.

## Prevention

Every adversarial timing scenario must own an independent counter namespace; tests must not rely on execution order to recreate a first-attempt condition.

## Resolution

Direct delayed evidence and response-loss reconciliation now use distinct contained scenario names and counter namespaces. Both independently prove a failed first artifact attempt, bounded retry, and exactly one provider dispatch. The complete suite passed 92/92.
