# SB-20260731-221744-task5-browser-deadline-contract: Browser helper rejected fractional clocks and admitted post-abort success

- **Status:** closed
- **First observed:** 2026-07-31T22:17:44.8415494Z
- **Last observed:** 2026-07-31T22:20:14.0437352Z
- **Phase/task:** Phase B Task 5 browser-helper independent review
- **Environment:** Local sanitized source/test review
- **Version/commit:** 7e95b61 plus uncommitted Task 5 lanes

## Symptom

The helper accepted finite nonnegative monotonic samples but then required the
computed 35-second deadline to be an integer, rejecting ordinary fractional
browser clock values. Separately, a fulfilled fetch was classified only from
page liveness and HTTP success, so a response resolving after abort could still
be reported as success.

## Impact

A valid browser execution could fail before the private factory runs, while an
abort race could produce a false success after the fixed deadline. Task 5 is
not acceptable until both cases are covered and repaired. No live request,
browser account, provider, network, staging, or external state was touched.

## Cause classification

- **Confirmed cause:** Integer validation was applied to a browser monotonic
  deadline, and the fulfilled-response branch did not recheck abort state.
- **Contributing cause:** Tests used only integer clock samples and only a
  fetch that rejected when aborted.

## Correction and prevention

- **Correction:** Add failing fractional-clock and fulfilled-after-abort tests;
  accept finite fractional monotonic deadlines and classify any post-abort
  fulfillment as aborted.
- **Prevention:** Test browser timing contracts with fractional samples and
  adversarial abort/resolve races.
- **Owner:** Codex.
- **Next diagnostic step:** Run the two new RED cases before source changes.

## Recurrence history

- 2026-07-31T22:17:44.8415494Z: Confirmed by independent read-only review.
- 2026-07-31T22:20:14.0437352Z: Closed after two exact RED failures reproduced
  the defects, fractional finite clocks and post-abort precedence were repaired,
  and all 14 browser-helper tests plus isolated strict TypeScript passed.
