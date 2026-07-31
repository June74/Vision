# SB-20260731-222202-task5-ai-uniqueness-close-overflow: AI uniqueness close could overflow and fail open

- **Status:** closed
- **First observed:** 2026-07-31T22:22:02.6141163Z
- **Last observed:** 2026-07-31T22:36:42.2172910Z
- **Phase/task:** Phase B Task 5 observer self-review
- **Environment:** Local sanitized diff review
- **Version/commit:** 7e95b61 plus uncommitted Task 5 lanes

## Symptom

The AI uniqueness path derived its close as `expiresAt + 3 minutes` without
validating that the resulting `Date` remained finite. A finite near-maximum
input could overflow to an invalid date, making comparisons fail open and
allowing premature uniqueness success.

## Impact

The observer could accept before the required uniqueness window closes for an
extreme admitted instant. Task 5 remains unaccepted. No live, provider,
network, staging, or external state changed.

## Cause classification

- **Confirmed cause:** Derived-time arithmetic lacked a post-addition finite
  range check.
- **Contributing cause:** Existing boundary tests did not include maximum-date
  overflow.

## Correction and prevention

- **Correction:** Add an overflow RED test and reject an invalid derived close
  before observation can succeed.
- **Prevention:** Validate every derived timestamp after arithmetic, not only
  its source instant.
- **Owner:** Codex.
- **Next diagnostic step:** Run the new overflow case before implementation.

## Recurrence history

- 2026-07-31T22:22:02.6141163Z: Found during scoped self-review before staging.
- 2026-07-31T22:26:06.1268586Z: Closed after the overflow regression joined
  the focused suite, the derived close was validated fail-closed, and all 220
  observer/workflow tests passed.
- 2026-07-31T22:31:53.8522986Z: Reopened when independent review found the
  controller has a second expiry-plus-three-minutes derivation that still
  permits `NaN` to bypass its 63-minute comparison. A controller-specific RED
  and immediate finite-date rejection are required.
- 2026-07-31T22:36:42.2172910Z: Closed after the controller-specific RED showed
  remote checks occurred before rejection, the finite canonical derived-close
  guard moved rejection ahead of dependencies, and all 63 controller tests
  passed.
