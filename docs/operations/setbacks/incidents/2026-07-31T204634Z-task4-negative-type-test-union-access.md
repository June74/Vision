# SB-20260731-204634-task4-negative-type-test-union-access: Negative context type test read the full union

- **Status:** closed
- **First observed:** 2026-07-31T20:46:34.2474790Z
- **Last observed:** 2026-07-31T20:48:28.8439202Z
- **Phase/task:** Phase B Task 4 workflow/window independent-review repair
- **Environment:** Local Phase B worktree type validation
- **Version/commit:** c23e301 plus Task 4 working changes

## Symptom

TypeScript rejected a runtime assertion in the new negative type regression
because it read an observe-only field from a value deliberately annotated as
the complete context union.

## Impact

The type gate stopped after focused behavior tests passed. No source behavior,
provider, network, database, workflow, or external state changed.

## Reproduction conditions

Assign a deliberately invalid non-AI observe fixture to the closed context
union under an expected-error directive, then read its observe-only property
through that union-typed alias without narrowing.

## Safe evidence

The compiler reported one test-file union-property category. No protected
value, argument, environment value, identifier, URI, or raw log was retained.

## Attempts and outcomes

- The focused runtime tests passed before the type gate.
- The type gate correctly stopped on the test-only union access.

## Cause classification

- **Confirmed cause:** The runtime assertion referenced the intentionally
  union-typed negative assignment instead of the original literal fixture.
- **Hypotheses:** None active.
- **Rejected hypotheses:** The production discriminated-union split itself is
  not the reported error.
- **Known exclusions:** Runtime parsing and window behavior remain green.

## Correction and prevention

- **Correction:** Assert against the original literal fixture while retaining
  the expected-error assignment solely as a compile-time boundary.
- **Prevention:** Keep negative type probes and runtime assertions on separate
  values so deliberate invalid typing does not widen runtime access.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the complete source and test typecheck.

## Verification and related work

The corrected complete source and test typecheck exited zero.

## Recurrence history

- 2026-07-31T20:46:34.2474790Z: First observed and contained locally.
- 2026-07-31T20:48:28.8439202Z: Closed after the corrected full typecheck
  exited zero.
