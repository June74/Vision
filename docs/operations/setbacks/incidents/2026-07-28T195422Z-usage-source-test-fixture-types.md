# SB-20260728-195422-usage-source-test-fixture-types: Usage source test fixtures mismatched runtime types

- **Status:** closed
- **First observed:** 2026-07-28T19:54:22.2560981Z
- **Last observed:** 2026-07-29T03:34:45Z
- **Phase/task:** Phase B acceptance instrumentation Task 5 typecheck
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
- 2026-07-28T21:07:55.8841349Z: The Task 3 production sources compiled, while
  the new database-client mock returned a base record array instead of
  preserving its generic row subtype. The fixture now casts only its synthetic
  rows at the port boundary; no runtime or provider state changed.
- 2026-07-28T21:08:42.5183444Z: Vitest's mock wrapper still erased the generic
  method even after the synthetic rows were cast. The fixture separates an
  inspectable non-generic mock from a generic port wrapper; no production or
  provider state changed.
- 2026-07-29T03:34:00Z: The Task 5 R2-failure fixture declared generic metadata
  instead of the real closed backup-metadata contract. Typecheck stopped before
  execution; the correction narrows the mock parameter to `BackupObjectWriter`.
- 2026-07-29T03:34:20Z: The corrected mock still returned the writer's boolean
  rather than the scheduled dependency's `Promise<void>` contract. No test ran;
  the fixture now awaits the writer and returns void.
- 2026-07-29T03:34:45Z: The first void-return patch left one extra closing call
  delimiter in the test fixture. Typecheck stopped before execution; a bounded
  source read identified and removed the delimiter.
