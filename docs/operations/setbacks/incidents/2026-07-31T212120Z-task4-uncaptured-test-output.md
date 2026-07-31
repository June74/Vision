# SB-20260731-212120-task4-uncaptured-test-output: Task 4 cleanup RED printed a nonsecret environment fixture

- **Status:** closed
- **First observed:** 2026-07-31T21:21:20.8759029Z
- **Last observed:** 2026-07-31T21:21:20.8759029Z
- **Phase/task:** Phase B Task 4 full-check cleanup-contract repair
- **Environment:** Local focused test output
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The focused cleanup test was run directly instead of through captured streams.
Its assertion diff printed source fixture text containing a nonsecret generated
selector binding/value pair and temporary binding names.

## Impact

No credential, token, URL, database value, email, user data, or live provider
value was exposed. The output nevertheless violated the stricter project rule
against printing raw arguments or environment values.

## Cause classification

- **Confirmed cause:** A test expected to pass was launched without the normal
  capture wrapper, so unexpected RED rendered its full assertion diff.
- **Hypotheses:** None remaining.
- **Known exclusions:** The rendered values were source-controlled synthetic
  acceptance fixtures, not secrets or live configuration.

## Correction and prevention

- **Correction:** Return to captured stdout/stderr for every remaining test,
  including expected-GREEN reruns.
- **Prevention:** Never infer that a small focused test is safe to render merely
  because the proposed patch is mechanical.
- **Owner:** Codex.
- **Next diagnostic step:** None; all further verification is captured.

## Recurrence history

- 2026-07-31T21:21:20.8759029Z: Observed, classified, and closed before the
  next test run.

