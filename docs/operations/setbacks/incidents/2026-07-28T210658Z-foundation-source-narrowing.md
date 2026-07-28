# SB-20260728-210658-foundation-source-narrowing: Foundation source types were not narrowed at closed boundaries

- **Status:** closed
- **First observed:** 2026-07-28T21:06:58.4530984Z
- **Last observed:** 2026-07-28T21:06:58.4530984Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 typecheck
- **Environment:** Local Windows worktree
- **Version/commit:** `36f9df2` plus uncommitted Task 3 implementation

## Symptom

Typecheck rejected a foundation classifier category that remained wider than
its three-value source allowlist and an R2 cursor read that was not narrowed by
the discriminated `truncated` field.

## Impact

The focused runtime tests passed, but the implementation was not type-safe and
was not eligible for completion. No provider or private state changed.

## Reproduction conditions

Run `pnpm.cmd typecheck` against the first focused-GREEN implementation.

## Safe evidence

The compiler identified one category narrowing and one R2 cursor narrowing in
the new Task 3 files. No runtime values or provider output were involved.

## Attempts and outcomes

- Focused tests passed before typecheck.
- The implementation is corrected with explicit allowlist and discriminant
  narrowing, then the same typecheck is rerun.

## Cause classification

- **Confirmed cause:** Runtime validation was present, but the corresponding
  TypeScript discriminants were not expressed narrowly enough.
- **Hypotheses:** None.
- **Rejected hypotheses:** No dependency or generated-type defect was found.
- **Known exclusions:** No source outside Task 3 boundaries required semantic
  changes.

## Correction and prevention

- **Correction:** Narrow the category to the source-category tuple member and
  read the cursor only from a truncated R2 page.
- **Prevention:** Run typecheck immediately after focused GREEN and mirror
  runtime discriminants in local TypeScript bindings.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected boundaries are covered by the next focused and typecheck runs.

## Recurrence history

- 2026-07-28T21:06:58.4530984Z: First observed and corrected.
