# SB-20260728-185523-maintenance-test-mock-result-type: Maintenance test mock result type mismatched

- **Status:** closed
- **First observed:** 2026-07-28T18:55:23.212834Z
- **Last observed:** 2026-07-28T18:56:39.1904429Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 typecheck
- **Environment:** Local TypeScript 5.9 test project
- **Version/commit:** `f3873fe` plus uncommitted Task 1 changes

## Symptom

Two order-tracking test mock implementations returned void after the scheduler dependency result was narrowed to no_work.

## Impact

TypeScript stopped before the complete gate. The mismatch was limited to test fixtures; no production, workflow, provider, or private state changed.

## Reproduction conditions

Override a literal-returning mock with an order-tracking implementation that
pushes a marker but omits the literal return.

## Safe evidence

TypeScript reported two fixture callbacks returning `Promise<void>` where
`Promise<"no_work">` was required.

## Attempts and outcomes

- The first typecheck stopped on the two fixture callbacks.
- Both callbacks now return `no_work` after recording their order marker.

## Cause classification

- **Confirmed cause:** `mockImplementation` replaced the original
  literal-returning body and did not preserve its return.
- **Hypotheses:** None.
- **Rejected hypotheses:** The production scheduler and result unions were not
  invalid.
- **Known exclusions:** No production, workflow, provider, or private state
  changed.

## Correction and prevention

- **Correction:** Return the required literal from every replacement mock
  implementation.
- **Prevention:** When narrowing dependency results, inspect
  `mockImplementation` bodies as well as initial mock factories.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Fresh typecheck and focused coordinator tests verify the corrected fixtures.

## Recurrence history

- 2026-07-28T18:55:23.212834Z: First observed.
