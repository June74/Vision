# SB-20260731-034509-task3-controller-test-error-stream-output: Focused controller test emitted an unsanitized error stream

- **Status:** closed
- **First observed:** 2026-07-31T03:45:09.0596591Z
- **Last observed:** 2026-07-31T20:08:18.4872536Z
- **Phase/task:** Phase B Task 3 isolated controller deadline verification
- **Environment:** Local controller-hardening Vitest run
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

The three-test verification used the normal dot reporter, so its nonzero run
printed the test-owned error message and local stack instead of returning only
safe counts and categories.

## Impact

The output contained no secret, provider value, protected row, external
identifier, child stream, or network data, but it exceeded the run's strict
category-only diagnostic rule.

## Reproduction conditions

Run a known potentially failing focused test group with the interactive
reporter instead of a captured structured reporter and safe classifier.

## Safe evidence

The output was limited to one test-owned failure category, one test name, and
local source locations. No protected value was present.

## Attempts and outcomes

- The run proved all three behavior assertions pass.
- It exited nonzero only because one test-owned unhandled rejection remained.
- No repository, provider, or external state changed.

## Cause classification

- **Confirmed cause:** The verification command did not capture and classify a
  potentially failing test stream before emission.
- **Hypotheses:** None.
- **Rejected hypotheses:** No child process stream was forwarded by production
  code.
- **Known exclusions:** Credentials, provider data, private content, and
  external state are unaffected.

## Correction and prevention

- **Correction:** Fix the confirmed test-handler ordering, then rerun through a
  captured structured reporter that emits only pass/fail and unhandled counts.
- **Prevention:** Until a focused group is fully green, use structured capture
  and category-only classification rather than direct reporter output.
- **Owner:** Codex.
- **Next diagnostic step:** Apply the test-only correction and use sanitized
  verification.

## Verification and related work

The corrected three-case verification was captured and classified without
emitting its stream. It exited zero, proved all three tests passed, and
reported zero unhandled markers.

## Recurrence history

- 2026-07-31T03:45:09.0596591Z: First observed and contained.
- 2026-07-31T03:46:42.2666190Z: Closed after a clean structured
  category-only rerun.
- 2026-07-31T20:06:06.6240319Z: Recurred when the initial Task 4 data RED run
  used the normal reporter and one unexpected fixture failure caused a local
  parameterized query diagnostic to enter the tool stream. The values were
  deterministic test-only fixtures, not credentials, provider data, external
  data, or production rows. Contained by switching all subsequent non-green
  runs to captured output with safe count/category extraction.
- 2026-07-31T20:08:18.4872536Z: Closed after the corrected RED was captured;
  safe classification showed no query or parameter diagnostic markers and
  only the two intended missing-method categories.
