# SB-20260731-205425-task4-permanent-tick-boundary: Task 4 rollback guard rejected the safe exact tick boundary

- **Status:** closed
- **First observed:** 2026-07-31T20:54:25.9461993Z
- **Last observed:** 2026-07-31T20:57:49.6815849Z
- **Phase/task:** Phase B Task 4 workflow/window independent-review repair
- **Environment:** Local source/test review
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The permanent-schedule guard treated a rollback bound ending exactly at a
quarter-hour or daily tick as overlap. The new isolated test encoded the same
reversed boundary.

## Impact

The defect fails closed by rejecting an otherwise safe activation instant; it
does not admit an unsafe overlap. It nevertheless violates the frozen exact
boundary contract and unnecessarily reduces the usable acceptance window.

## Cause classification

- **Confirmed cause:** The tick comparison used inclusive end semantics even
  though rollback occupancy is half-open at its end.
- **Contributing cause:** The test described distance from the tick rather than
  asserting the explicit safe-equality and one-millisecond-overlap cases.
- **Known exclusions:** No live workflow, provider, database, network, secret,
  staging state, or commit changed.

## Correction and prevention

- **Correction:** Accept a rollback end exactly at the tick; reject when it
  extends one millisecond beyond. Lock both quarter-hour and daily cases.
- **Prevention:** State interval inclusivity explicitly beside every schedule
  boundary comparison and name tests by occupancy outcome.
- **Owner:** Codex workflow/window lane.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

The corrected daily and quarter-hour tests first failed only at safe equality,
then passed after both comparisons adopted half-open end semantics. The focused
window/context suite passed 32 tests, and complete type and documentation
checks exited zero.

## Recurrence history

- 2026-07-31T20:54:25.9461993Z: Confirmed by rereading the frozen boundary rule
  against the helper and isolated daily fixture.
- 2026-07-31T20:56:35Z: RED reproduced safe-equality rejection independently
  for both daily and quarter-hour ticks; the remaining window tests passed.
- 2026-07-31T20:57:49.6815849Z: Closed after focused GREEN, complete
  typecheck, and documentation coverage all exited zero.
