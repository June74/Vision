# SB-20260816-145455-phase-b-progress-anchor-regression: Phase B progress heading lost a retained cleanup anchor

- **Status:** closed
- **First observed:** 2026-08-16T14:54:55.8227633Z
- **Last observed:** 2026-08-16T14:54:55.8227633Z
- **Phase/task:** Phase C isolated-worktree baseline verification
- **Environment:** Local Phase C Windows worktree using the explicit local Vitest binary
- **Version/commit:** `cc3134580512c44d726d4701ad72767b838a8f72`

## Symptom

The baseline unit suite failed one documentation cleanup-contract test because
`docs/operations/phase-b-progress-simple.md` no longer contained the retained
`## Current milestone` heading anchor.

## Impact

The Phase C baseline was not green until the documentation compatibility was
repaired. No application, provider, credential, database, key, or deployment
state changed.

## Reproduction conditions

Run the unit suite at the Phase C starting commit after the Phase B handoff
documentation changed the heading to `## Current accepted milestone —
2026-08-12` while the retained-history cleanup contract still expected the
original anchor phrase.

## Safe evidence

The full baseline reported 102 passing test files, 1 skipped file, and one
failure in `tests/security/temporary-surface-cleanup.test.ts`. The focused
cleanup test reproduced the failure before the repair and passed all 16 tests
after the repair.

## Attempts and outcomes

- The full unit baseline was run once and stopped on the one anchor mismatch.
- Repository history and the cleanup contract were compared before any edit.
- The heading was changed to `## Current milestone — accepted 2026-08-12`.
- The focused cleanup contract then passed 16/16 tests.

## Cause classification

- **Confirmed cause:** The Phase B documentation reconciliation renamed a
  historical heading that the retained-history contract intentionally matches
  by its original anchor phrase.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The failure was not caused by Vitest, dependency
  resolution, or a production code path; the focused test passed after the
  one-line documentation repair.
- **Known exclusions:** No external request or protected value was involved.

## Correction and prevention

- **Correction:** Restored the required `## Current milestone` phrase while
  preserving the accepted date in the heading.
- **Prevention:** Treat retained historical anchors as compatibility contracts
  when reconciling operational documentation, and run the cleanup-contract
  test before declaring a docs-only baseline green.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the complete local baseline after the Phase C
  implementation plan is recorded.

## Verification and related work

`node_modules\\.bin\\vitest.cmd run --project unit
tests/security/temporary-surface-cleanup.test.ts` passed 1 file and 16 tests.

