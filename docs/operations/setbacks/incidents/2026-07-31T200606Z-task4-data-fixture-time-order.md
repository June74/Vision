# SB-20260731-200606-task4-data-fixture-time-order: Task 4 aggregate RED mixed reverse-time lifecycle fixtures

- **Status:** closed
- **First observed:** 2026-07-31T20:06:06.6240319Z
- **Last observed:** 2026-07-31T20:08:18.4872536Z
- **Phase/task:** Phase B Task 4 aggregate data TDD RED
- **Environment:** Local PGlite integration test only
- **Version/commit:** 2cf0ff1 plus Task 4 RED tests

## Symptom

One new active-status fixture composed a conservative-settlement helper whose
clock preceded lifecycle rows already created earlier in the same test. The
fixture failed before reaching the intentionally absent Task 4 method.

## Impact

Eleven new cases produced the expected missing-method RED. One case produced
an unrelated fixture failure, so that case is not accepted as TDD RED yet.

## Reproduction conditions

Create current-time terminal reservations, then invoke the existing helper
that begins two minutes earlier in the same database fixture.

## Safe evidence

The focused run collected one file: 16 existing tests passed, 11 new tests
failed for the intended missing methods, and one new test failed during local
fixture setup. No live database, network, provider, secret, user row, or Git
operation occurred.

## Attempts and outcomes

- The exact focused repository-local runner collected all 28 tests.
- The unexpected failure is isolated to test-fixture time ordering.

## Cause classification

- **Confirmed cause:** The combined test invoked a helper with an earlier
  logical clock after later lifecycle operations in the same fixture.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The missing Task 4 methods are not responsible for
  this setup failure.
- **Known exclusions:** Production source, schema, migrations, external state,
  credentials, and provider operations were unchanged.

## Correction and prevention

- **Correction:** Use monotonically ordered fixtures or test each terminal
  lifecycle independently, then recapture an exact missing-method RED.
- **Prevention:** Keep lifecycle fixture timestamps monotonic within each
  PGlite database and never compose helpers with hidden earlier clocks.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Correct the fixture and rerun through captured,
  safely classified output.

## Verification and related work

The corrected captured RED collected 30 tests: 16 existing tests passed and all
14 new tests failed only because the two Task 4 methods were absent. Safe
classification found zero query/parameter diagnostic markers.

## Recurrence history

- 2026-07-31T20:06:06.6240319Z: First observed and contained with zero source
  or external-state mutation.
- 2026-07-31T20:08:18.4872536Z: Closed after monotonic fixture separation and
  an exact, safely classified missing-method RED.
