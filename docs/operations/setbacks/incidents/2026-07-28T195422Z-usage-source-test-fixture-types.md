# SB-20260728-195422-usage-source-test-fixture-types: Usage source test fixtures mismatched runtime types

- **Status:** closed
- **First observed:** 2026-07-28T19:54:22.2560981Z
- **Last observed:** 2026-07-28T19:54:22.2560981Z
- **Phase/task:** Phase B acceptance instrumentation Task 2 typecheck
- **Environment:** Local Phase B worktree
- **Version/commit:** Task 2 patch based on `429124f`

## Symptom

Typecheck reported three incomplete synthetic R2 pages and one concurrency test
still passing the retired static warning shape.

## Impact

Typecheck stopped with four test-only errors. No runtime or provider state
changed.

## Reproduction conditions

Run both TypeScript projects after replacing the diagnostic warning dependency
with `UsageWarningSource`.

## Safe evidence

The compiler named only fixture fields and the removed interface member.

## Attempts and outcomes

- Production source and route compilation passed.
- The errors were confined to test fixtures.

## Cause classification

- **Confirmed cause:** The test migration omitted required R2 page structure
  and one non-diagnostics call site.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production interface mismatch remained.
- **Known exclusions:** No provider detail or private value was involved.

## Correction and prevention

- **Correction:** Complete the R2 page shapes and inject an async warning source
  into the concurrency fixture.
- **Prevention:** Use full typecheck after repository-port changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Rerun `pnpm.cmd typecheck`.

## Recurrence history

- 2026-07-28T19:54:22.2560981Z: First observed and contained.
