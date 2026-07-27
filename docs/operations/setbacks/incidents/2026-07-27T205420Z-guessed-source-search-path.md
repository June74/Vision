# SB-20260727-205420-guessed-source-search-path: Source search included a nonexistent path

- **Status:** closed
- **First observed:** 2026-07-27T20:54:20Z
- **Last observed:** 2026-07-27T20:54:20Z
- **Phase/task:** Listener-first restore retry implementation planning
- **Environment:** Local Phase B worktree
- **Version/commit:** `e6240ce`

## Symptom

A read-only content search included the guessed `src/db` directory. PowerShell
reported that the path does not exist while continuing to read the valid,
explicitly listed paths.

## Impact

The search output was noisy and the intended backup-table discovery was
incomplete. No source file, Git state, secret, database, Worker, or provider
state changed.

## Cause classification

- **Confirmed cause:** A source directory was inferred instead of first being
  discovered from the repository tree.
- **Known exclusions:** The valid scheduled-job and environment files were
  read successfully.

## Correction and prevention

- **Correction:** Enumerate existing source files before applying the targeted
  content search.
- **Prevention:** Use only paths returned by repository discovery; do not add
  conventional directory names from memory.

## Verification and related work

Closure is immediate because the failed operation was read-only. Planning
continues using discovered files only.
