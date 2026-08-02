# Task 7 Task 6 expired stable lease cleanup gap

- **Occurred:** 2026-08-01T23:18:13.7332573Z
- **Status:** closed
- **Resolved:** 2026-08-01T23:20:59.8556665Z
- **Phase:** Phase B / tracked correlation repair / Task 6 pre-freeze review
- **Category:** uncovered lifecycle contract

## What happened

After the first 86/86 contained GREEN, root source review found that exact expired request, consuming-response, and claimed-lease records were eligible for confined cleanup, but an exact expired stable approval-lease record was not.

An approval lease abandoned before action could therefore remain in the configured control directory. Repeated abandoned approvals could accumulate or make later exact action-lease selection fail closed indefinitely.

No live state was involved, no sensitive value was inspected or disclosed, and no provider operation occurred.

## Impact

Task 6 cannot be frozen or independently reviewed yet. The existing cleanup assertion did not cover this required stable-lease lifecycle.

## Corrective action

Extend the existing cleanup category with one exact expired stable approval lease for a nonmatching valid tuple, proving it is removed by cleanup rather than accidentally consumed by the action under test. Add only the exact stable lease filename/schema/expiry rule to the driver, then rerun all 86 assertions, syntax checks, privacy counts, and default-root non-mutation proof.

## Prevention

For every durable lifecycle state named in a cleanup contract, include a direct adversarial fixture that cannot disappear through an unrelated success or claim path.

## Resolution

The existing cleanup category first produced the intended 85/86 RED with an unrelated exact expired stable lease. The driver then admitted only that exact filename, schema, nonce, and expiry rule for confined deletion. The final suite returned 86/86, syntax passed, all privacy counts were zero, and the default control root remained unchanged.
