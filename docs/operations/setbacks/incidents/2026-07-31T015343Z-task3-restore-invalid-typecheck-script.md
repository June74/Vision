# SB-20260731-015343-task3-restore-invalid-typecheck-script: Task 3 restore worktree package-manager typecheck did not start the compiler

- **Status:** closed
- **First observed:** 2026-07-31T01:53:43.711925Z
- **Last observed:** 2026-07-31T01:56:57.3012153Z
- **Phase/task:** Phase B Task 3 isolated restore repair
- **Environment:** Isolated restore-contract worktree; Windows pnpm wrapper
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus restore RED tests

## Symptom

Two package-manager forms for the repository's existing typecheck script exited
before TypeScript produced diagnostics in the junctioned isolated worktree.

## Impact

Static verification paused after the intended RED tests; no source, provider, live, or protected state changed.

## Reproduction conditions

Invoke the typecheck package script through pnpm in the isolated restore
worktree whose dependency directory is a local junction.

## Safe evidence

The writer captured the command output and returned only a nonzero boolean and
the missing-script category. No URI-bearing help text was emitted to the
controller or user.

## Attempts and outcomes

- The invalid script did not start TypeScript.
- The intended restore RED suite did run separately and produced three
  expected assertion failures.
- A second guessed package-script form also exited before TypeScript produced
  diagnostics.
- Controller inspection confirmed that the `typecheck` key does exist,
  rejecting the initial missing-script diagnosis.
- The repository-local TypeScript Windows wrapper completed successfully.

## Cause classification

- **Confirmed cause:** The failure is at the pnpm invocation/environment
  boundary in this junctioned worktree, before the existing typecheck script
  reaches the compiler. The deeper pnpm-specific reason is not required for
  the bounded repair.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The package-script key is not missing; the
  repository manifest contains it, and the direct compiler wrapper succeeds.
- **Known exclusions:** No dependency, source, provider, live request,
  protected value, or external state changed.

## Correction and prevention

- **Correction:** Invoke the repository-local Windows TypeScript wrapper
  directly with the repository's no-emit setting.
- **Prevention:** In short-lived junctioned worktrees, validate package-script
  keys but prefer the proven local `.cmd` wrapper for ad hoc compiler and test
  execution.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; continue restore RED/GREEN work.

## Verification and related work

The direct TypeScript wrapper exited successfully with no diagnostics.

## Recurrence history

- 2026-07-31T01:53:43.711925Z: First observed.
- 2026-07-31T01:54:53.7717288Z: The restore writer tried a second inferred
  typecheck script form instead of waiting for the repository key inventory.
  It exited before compiler diagnostics and changed no file or external state.
- 2026-07-31T01:56:57.3012153Z: The controller corrected its own initial
  missing-script classification after verifying the manifest key. The direct
  compiler wrapper passed, isolating the failure to the package-manager route
  in the junctioned worktree.
