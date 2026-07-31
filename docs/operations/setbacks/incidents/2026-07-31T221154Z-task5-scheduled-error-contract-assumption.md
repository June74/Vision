# SB-20260731-221154-task5-scheduled-error-contract-assumption: Scheduled tests assumed the wrong frozen error contract

- **Status:** closed
- **First observed:** 2026-07-31T22:11:54.0525191Z
- **Last observed:** 2026-07-31T22:15:58.2855898Z
- **Phase/task:** Phase B Task 5 scheduled-entry GREEN
- **Environment:** Local focused integration tests
- **Version/commit:** 7e95b61 plus uncommitted Task 5 lanes

## Symptom

The scheduled-entry suite passed 46 of 49 tests. Three new assertions expected
a generic timing error, but malformed or protected AI windows are rejected by
Task 4's established constant safe window error.

## Impact

The focused suite is not green until the new tests match the frozen upstream
contract. No production defect, sensitive output, live action, staging, or
external mutation was observed.

## Cause classification

- **Confirmed cause:** New test assertions inferred an error string instead of
  preserving the accepted Task 4 parser contract.
- **Known exclusions:** Scheduled ordering and 46 other tests behave as
  intended; production error behavior should not change.

## Correction and prevention

- **Correction:** Update only the three assertions to the established constant
  safe window error and rerun the identical suite.
- **Prevention:** Trace and assert accepted upstream error contracts before
  writing boundary tests.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun all 49 scheduled-entry tests.

## Recurrence history

- 2026-07-31T22:11:54.0525191Z: Logged before correcting assertions.
- 2026-07-31T22:15:58.2855898Z: Closed after preserving the Task 4 safe error
  contract and passing all 66 tests across the three assigned scheduled lanes.
