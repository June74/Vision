# Task 7 integration review found direct-dispatch evidence bypass

- **Occurred:** 2026-08-01T23:58:09.2322006Z
- **Status:** closed
- **Closed:** 2026-08-02T00:45:44.1312694Z
- **Phase:** Phase B / tracked correlation repair / Task 7 independent integration review
- **Category:** evidence-chain reachability gap
- **Review verdict:** FAIL
- **Severity counts:** Critical 0, Important 1, Minor 0

## What happened

The fresh integration review found that response-loss reconciliation verifies the exact dispatch-correlation artifact before mapping a provider run, but the normal successful dispatch path maps the direct provider receipt immediately. Later attribution does not compensate by verifying the same artifact.

The direct happy path can therefore proceed without independently validating the operation, reviewed commit, and canonical-context digest carried by the correlation evidence.

## Final resolution

The direct path now verifies the exact retained dispatch-correlation evidence before creating an opaque mapping, including bounded delayed-evidence reconciliation without redispatch. The contained driver self-test passed 92/92 and the final integration review passed with zero findings.

No live state was accessed and no mutation or test was performed by the reviewer.

## Impact

Repair Task 7 is not accepted. Its normal and recovery dispatch paths do not yet share the same evidence-before-mapping guarantee, so Task 8 re-admission cannot begin.

## Corrective action

- Add a contained RED proving direct dispatch does not return an opaque mapping until the exact correlation artifact is available and verified.
- Reuse the bounded artifact polling and exact evidence verifier on direct success before mapping the provider receipt.
- Cover delayed artifact availability, terminal absence, wrong digest/operation/commit, and no mapping on failure without duplicating the provider mutation.
- Rerun the contained driver suite, focused tracked suite, type/docs/security gates, strict pre-cleanup evidence, and a fresh integration review.

## Prevention

Every path that converts a provider receipt into durable or opaque local identity must pass the same independent correlation-evidence verifier. A successful transport response is not evidence-chain completion.
