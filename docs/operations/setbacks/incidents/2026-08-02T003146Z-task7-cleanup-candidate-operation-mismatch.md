# Task 7 cleanup supplied a transition name where candidate operation was required

- **Occurred:** 2026-08-02T00:31:46Z
- **Status:** closed
- **Closed:** 2026-08-02T00:34:47.4428106Z
- **Phase:** Phase B / tracked correlation repair / Task 7 proof-chain reachability GREEN
- **Category:** live validator input mismatch

## What happened

Post-GREEN call-path tracing found that the combined rollback proof-chain validator requires the original candidate operation, but the cleanup workflow supplied the current transition name `verify_cleanup`. The previous narrower closure validator explicitly allowed that transition name, so reusing its argument would make the combined validator fail closed in every real cleanup run.

The mismatch was found locally before live execution or a completion claim.

## Impact

The combined validator is graph-reachable but not yet invocable with semantically valid inputs. Task 7 remains unaccepted. No external state changed.

## Corrective action

- Add a failing CLI test for reading the exact candidate operation from the already-validated candidate intent.
- Add a value-only reader that rejects invalid or legacy intent.
- Pass that extracted candidate operation to the combined validator.
- Add graph assertions for the reader and variable binding, then rerun all gates and fresh review.

## Prevention

When replacing one validator with another, trace and compare each argument's semantic contract; identical flag names do not prove identical accepted value domains.

## Resolution evidence

A fixed-output CLI mode now reads only the validated v2 candidate operation. Cleanup passes that value to the combined validator. The CLI RED became GREEN, the workflow graph test became GREEN, the complete Task 7 suite passed 196/196, and type, documentation, and security gates passed.
