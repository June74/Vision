# SB-20260728-194727-usage-sql-alias-case-assertion: Usage SQL alias assertion used inconsistent case

- **Status:** closed
- **First observed:** 2026-07-28T19:47:27.7964835Z
- **Last observed:** 2026-07-28T19:47:27.7964835Z
- **Phase/task:** Phase B acceptance instrumentation Task 2 GREEN
- **Environment:** Local Phase B worktree
- **Version/commit:** Task 2 patch based on `429124f`

## Symptom

Eight usage-source tests reported the database warning as true while their R2
expectations behaved as designed.

## Impact

The focused test run failed. No provider, repository history, or runtime state
changed.

## Reproduction conditions

Use the database test helper, lowercase the compiled SQL, and compare it to a
pattern containing a mixed-case alias.

## Safe evidence

The helper assertion rejected the read-only SQL before returning its synthetic
aggregate row. The source then correctly classified that mock rejection as a
database measurement failure.

## Attempts and outcomes

- The failed assertions consistently showed only the fail-safe database flag.
- Inspection found the case mismatch inside the test helper.

## Cause classification

- **Confirmed cause:** The test lowercased the compiled query but its regular
  expression still expected `databaseBytes`.
- **Hypotheses:** None.
- **Rejected hypotheses:** The source did not conflate database and R2 failure.
- **Known exclusions:** No private value, object identity, cursor, or provider
  error entered output.

## Correction and prevention

- **Correction:** Match the lowercased `databasebytes` alias.
- **Prevention:** Normalize both sides of future SQL text comparisons.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The same focused policy and source tests are rerun after the assertion change.

## Recurrence history

- 2026-07-28T19:47:27.7964835Z: First observed and contained.
