# SB-20260729-052113-task6-test-helper-type-widening: Config test helpers widened structured values

- **Status:** closed
- **First observed:** 2026-07-29T05:20:55Z
- **Last observed:** 2026-08-01T00:31:28.6602348Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 typecheck
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

The focused runtime tests passed, but test-project typechecking rejected direct
property access on helper values typed as generic objects and one `it.each`
table whose mapped rows widened from fixed three-item tuples.

## Impact

Four compile-time errors prevented the full verification gate. Runtime tests
and production behavior were unaffected. No runtime, provider, database,
browser, or network state changed.

## Reproduction conditions and safe evidence

`tests/unit/server/wrangler-routing.test.ts` used broad `{}` inference for
parsed config members and mapped the six fault values without preserving a
readonly tuple result.

## Attempts and outcomes

- The focused Vitest suite passed because the runtime values were correct.
- `pnpm typecheck` exposed the narrower compile-time contract.

## Cause classification

- **Confirmed cause:** Test helper types were less precise than their accessed
  JSON shape, and mapped parameter rows were inferred as variable-length
  arrays.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production scheduler, builder, or validator type
  failed.
- **Known exclusions:** No live state or evidence schema changed.

## Correction and prevention

- **Correction:** Add explicit test-only config shapes and preserve fixed tuple
  rows for the parameterized cases.
- **Prevention:** Type JSON fixtures at the boundary and annotate mapped
  `it.each` rows when Vitest requires positional tuple inference.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm typecheck` passed after the test-only type corrections.

## Recurrence history

- 2026-07-31T22:55:58Z: Task 6 integration typechecking rejected two
  cleanup-inventory test assertions because readonly path tuples were passed
  to a mutable-array matcher signature. The safe-runner focused suite remained
  green. The failure is contained to the concurrently owned cleanup-inventory
  test; no provider, network, database, workflow, or deployment action ran.
  Rerun typecheck after that lane narrows the helper signature.
- 2026-08-01T00:31:28.6602348Z: Closed after the cleanup helper accepted the
  readonly contract and the final controller TypeScript checks and complete
  repository gate both exited zero.
