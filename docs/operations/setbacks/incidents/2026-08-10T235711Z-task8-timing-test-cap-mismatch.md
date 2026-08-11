# SB-20260810-235711-task8-timing-test-cap-mismatch

- Incident ID: `SB-20260810-235711-task8-timing-test-cap-mismatch`
- First observed: `2026-08-10T23:57:11Z`
- Last observed: `2026-08-11T00:33:52.829Z`
- Status: `closed`
- Phase/task: Phase B observer-margin regression
- Environment: Vitest focused controller/resolver suites
- Version/commit: `c2c64365` plus uncommitted timing repair

## Symptom

The first RED-to-GREEN run after the timing change still failed one resolver
test because its fake timer advanced only the old five-second terminal margin.

## Impact

Only the focused local test run failed. No application, branch, provider,
deployment, traffic, secret, key, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** the production margin was updated to 30 seconds, but a
  test fixture still modeled the old five-second abort.
- **Rejected hypotheses:** the observer timing repair itself was not disproven;
  the failure was a stale test expectation.

## Correction and prevention

The fixture now advances the full 30-second terminal margin. Keep timing
constants and fake-clock assertions synchronized when changing bounded waits.

## Next step

Run the focused suites again, then run the full repository verification before
committing the repair.

## Recurrence

- 2026-08-11T00:33:52.829Z: Widening the live terminal margin to 60 seconds
  exposed one additional stale controller test expectation at 150 seconds.
  Only the focused local suite failed; no application, branch, provider,
  deployment, traffic, secret, key, database, or calendar state changed.
- 2026-08-11T00:39:17.035Z: The full TypeScript check rejected the new timing
  test because its runtime null assertions did not narrow the captured values
  for the compiler. No application, branch, provider, deployment, traffic,
  secret, key, database, or calendar state changed.
