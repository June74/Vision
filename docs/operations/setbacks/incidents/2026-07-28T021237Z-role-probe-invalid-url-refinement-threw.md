# SB-20260728-021237-role-probe-invalid-url-refinement-threw: Role-probe invalid URL refinement threw

- **Status:** closed
- **First observed:** 2026-07-28T02:12:37.2847543Z
- **Last observed:** 2026-07-28T02:13:34.9788054Z
- **Phase/task:** Preview database role probe Task 1 GREEN
- **Environment:** Local Phase B worktree
- **Version/commit:** `59e6a02`

## Symptom

The new invalid-configuration regression rejected its input at the base URL
validator, but the shared database-role refinement still called the platform
URL constructor and threw instead of returning the fixed configuration
evidence.

## Impact

The focused GREEN command failed one test, and the test runner rendered a
synthetic private-shaped sentinel from the thrown local error. No real secret,
authenticated URL, provider value, network request, database access, or
deployment was involved.

## Reproduction conditions

Pass a non-URL string through the shared database URL schema and call
`safeParse` from the temporary preview role-probe job.

## Safe evidence

The focused five-file command passed 46 tests and failed the single invalid
configuration case because parsing rejected with a platform URL error instead
of resolving to closed evidence.

## Attempts and outcomes

- The failing command was stopped after the one unexpected result.
- No implementation retry occurred before this incident was recorded.

## Cause classification

- **Confirmed cause:** The database schema's custom role refinement constructs
  a URL without first verifying that the base URL validator accepted the
  string.
- **Hypotheses:** None.
- **Rejected hypotheses:** The adapter and provider boundaries were not
  reached.
- **Known exclusions:** No real private value, provider state, database state,
  commit, push, browser, or network action occurred.

## Correction and prevention

- **Correction:** The shared refinement now returns after a local URL parse
  rejection, leaving the base schema to report the fixed validation failure.
- **Prevention:** Custom refinements that parse a value must return a fixed
  issue instead of allowing platform parsers to throw or echo the input.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The exact five-file focused command exited zero with 47/47 tests passing.

## Recurrence history

- 2026-07-28T02:12:37.2847543Z: First observed and contained before correction.
- 2026-07-28T02:13:34.9788054Z: The guarded refinement returned closed
  configuration evidence, and the exact focused rerun passed 47/47 tests
  without rendering the synthetic sentinel.
