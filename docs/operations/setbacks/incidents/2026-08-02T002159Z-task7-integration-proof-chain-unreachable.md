# Task 7 integration review found proof-chain validator unreachable

- **Occurred:** 2026-08-02T00:21:59.7167540Z
- **Status:** closed
- **Closed:** 2026-08-02T00:45:44.1312694Z
- **Phase:** Phase B / tracked correlation repair / Task 7 integration re-review
- **Category:** live graph reachability gap
- **Review verdict:** FAIL
- **Severity counts:** Critical 0, Important 1, Minor 0

## What happened

The fresh integration re-review confirmed the direct-dispatch evidence repair, then found that the exact combined candidate-intent, restore-proof, and closure-proof validator is not called by the live workflow/controller cleanup graph.

The workflow calls a narrower closure verifier, while the joint anti-substitution validator is reachable only through a standalone CLI mode exercised directly by a unit test.

## Final resolution

The closure-run artifact now retains both the copied restore proof and closure proof. The live cleanup job reads the validated candidate operation and invokes the exact combined proof-chain validator before provider cleanup. The final integration review passed with zero findings.

No live state was accessed and no mutation or test was performed by the reviewer.

## Impact

Repair Task 7 remains unaccepted. The live cleanup path can complete without enforcing the intended joint operation, reviewed-commit, candidate-identity, restore, closure, and ordering proof.

## Corrective action

- Add a graph-level RED proving the live cleanup workflow invokes the exact combined proof-chain CLI mode with all required artifacts and bindings.
- Replace or augment the narrower cleanup verification step with the combined validator at the correct post-rollback boundary.
- Keep artifact paths fixed and outputs value-free; do not expose run references or proof bodies.
- Rerun workflow graph tests, the focused suite, type/docs/security gates, strict pre-cleanup evidence, and a fresh integration review.

## Prevention

Security validators are not implemented until the live workflow graph invokes them with every required input. Pair direct unit tests with reachability assertions from the actual job step.
