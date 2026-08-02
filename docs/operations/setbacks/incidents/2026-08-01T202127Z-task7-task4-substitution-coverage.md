# SB-20260801-202127-task7-task4-substitution-coverage: Task 4 tests did not exercise exact restore-proof substitutions

- **Status:** closed
- **First observed:** 2026-08-01T20:21:27.2529058Z
- **Last observed:** 2026-08-01T20:28:57.5261595Z
- **Phase/task:** Phase B Task 7 correlation repair Task 4
- **Environment:** Local Phase B worktree
- **Version/commit:** admitted baseline `10b228b`

## Symptom

Post-GREEN inspection found that the new assertion tests changed supplied scalar operation and commit bindings or replaced a restore/closure pair together. The approved plan requires independent substitution of only the restore proof from another candidate, operation, commit, and older provider instant.

## Impact

The implementation appears to enforce the bindings and 30 focused tests plus typecheck passed, but Task 4 cannot enter independent review until the exact adversarial substitutions are covered. No live/provider, secret, key, deployment, or commit state changed.

## Reproduction conditions

Compare the new exact-chain test cases with Task 4 Step 1 in the approved correlation-repair plan and identify which object is substituted in each case.

## Safe evidence

The test inventory contains scalar-binding changes and one combined proof-pair replacement, but no restore-only proof created with a different run reference or commit. No concrete identifier, digest, or private value is recorded here.
The correction added separately named restore-only substitutions and exact CLI grammar failures; focused verification and independent review passed.

## Attempts and outcomes

- The implementation worker completed a genuine missing-interface/mode RED, 30-test GREEN, and passing typecheck.
- Root post-GREEN inspection stopped review admission when the substitution-object mismatch was found.
- Test-only correction produced 35 passing focused tests and a passing typecheck without changing production.
- Frozen-diff independent review returned 0 Critical, 0 Important, and 0 Minor findings.

## Cause classification

- **Confirmed cause:** The tests demonstrated broad mismatch rejection but did not mirror the plan's exact restore-only substitution boundaries.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None yet.
- **Known exclusions:** No live/provider action, private-data exposure, workflow edit, or backup-key change occurred.

## Correction and prevention

- **Correction:** Added independent restore-only substitutions for candidate, operation, commit, and older timestamp bindings plus missing, extra, and duplicate CLI argument cases; production remained unchanged.
- **Prevention:** Translate each plan noun and substituted object into a separate named test case; do not treat scalar-argument changes as proof-object substitution evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Proceed to the approved exact provider-dispatch and opaque-handle task.

## Verification and related work

Final verification: 35 focused lifecycle tests passed, typecheck passed, the frozen diff privacy scan found no prohibited patterns, and fresh review returned zero findings at every severity.

## Recurrence history

- 2026-08-01T20:21:27.2529058Z: First observed and contained before Task 4 review.
- 2026-08-01T20:28:57.5261595Z: Exact substitution and CLI coverage passed focused verification and zero-finding review; incident closed.
