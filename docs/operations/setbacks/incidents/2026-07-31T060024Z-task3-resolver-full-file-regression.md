# SB-20260731-060024-task3-resolver-full-file-regression: Resolver repair caused two existing compatibility failures

- **Status:** closed
- **First observed:** 2026-07-31T06:00:24.0943817Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
- **Phase/task:** Phase B Task 3 resolver final-review repair
- **Environment:** Main Phase B worktree; focused full resolver test file
- **Version/commit:** c5de12d plus owned resolver repair

## Symptom

The complete resolver test file collected 66 tests, passed 64, and failed two
existing compatibility cases after all 10 new repair cases had passed
individually.

## Impact

The resolver repair is not integration-ready. Changes remain limited to the
resolver source, its unit test, and simple/technical resolver references.

## Reproduction conditions

Run the entire focused resolver test file after implementing boundary
propagation, skipped-duplicate handling, and conservative uniqueness close.

## Safe evidence

The writer returned only aggregate counts: 66 collected, 64 passed, two
failed. No test name, assertion payload, source stream, URI, credential,
protected identifier, provider value, argument list, or environment value was
emitted.

## Attempts and outcomes

- Four new outer-boundary tests passed.
- Three new realistic full-job-list tests passed.
- Three new uniqueness-close tests passed.
- The complete file exposed two compatibility regressions.
- No stage, commit, provider action, or external mutation occurred.

## Cause classification

- **Confirmed cause:** One production change accidentally altered legacy
  unbounded terminal-poll scheduling; one existing strict-object test was stale
  because the valid result now requires the conservative close field.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The 10 new contract cases are not red.
- **Known exclusions:** Changes remain within the four owned resolver paths.

## Correction and prevention

- **Correction:** Safely classify only the two failure categories, preserve the
  new contracts, and restore backward-compatible behavior.
- **Prevention:** Run the complete owned test file after each contract group,
  not only the new cases.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Legacy scheduling was restored while bounded settlement remained intact, and
the stale strict result expectation was updated. The full resolver file passed
66 of 66 tests.

## Recurrence history

- 2026-07-31T06:00:24.0943817Z: First observed and contained before diagnosis.
- 2026-07-31T14:05:00.9419278Z: Closed after both compatibility cases, all 10
  new contracts, and the full 66-test file passed.
