# SB-20260730-020621-operations-root-literal-comparison: Operations-history disjointness used an impossible literal comparison

- **Status:** closed
- **First observed:** 2026-07-30T02:06:21.7997526Z
- **Last observed:** 2026-07-30T02:07:15.6050634Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 5
- **Environment:** Local Phase B linked worktree
- **Version/commit:** Uncommitted cleanup-contract change based on `3b735be`

## Symptom

`pnpm typecheck` reported TS2367 because the new history-boundary assertion
compared an active operations file literal directly with the
`docs/operations/setbacks` directory literal.

## Impact

The first typecheck gate failed. No runtime, provider, browser, network, Git
metadata, or external state changed.

## Reproduction conditions and safe evidence

Typecheck the cleanup regression while its directory disjointness predicate
contains both `path === root` and `path.startsWith(...)`. The literal unions
prove the equality branch can never be true.

## Attempts and outcomes

- The focused default cleanup test passed before typecheck.
- TypeScript rejected only the impossible equality branch.
- The assertion was narrowed to the meaningful descendant-prefix check.

## Cause classification

- **Confirmed cause:** The runtime-style equality guard was redundant after
  TypeScript inferred exact, non-overlapping file and directory literal unions.
- **Hypothesis:** The equality branch might still be needed for a generic
  runtime path supplied outside the literal inventory.
- **Rejected hypothesis:** Both operands come only from closed literal
  inventories in this test, so no generic runtime path can reach the branch.
- **Known exclusions:** Cleanup inventory contents and active/history
  classification are unchanged.

## Correction and prevention

- **Correction:** Remove the impossible equality branch.
- **Prevention:** Prefer assertions that preserve exact literal inference and
  avoid generic runtime guards when the static contract is narrower.
- **Owner:** Codex.
- **Next diagnostic step:** None; the corrected typecheck passed.

## Verification and related work

`pnpm.cmd typecheck` completed successfully after the equality branch was
removed.
