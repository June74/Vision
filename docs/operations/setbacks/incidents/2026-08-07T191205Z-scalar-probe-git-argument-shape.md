# SB-20260807-191205-scalar-probe-git-argument-shape: Git scalar probe command shape was invalid

- **Status:** closed
- **First observed:** 2026-08-07T19:12:05Z
- **Last observed:** 2026-08-07T19:12:05Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** No project change; verification-only probe

## Symptom

Two attempted PowerShell constructions for a read-only Git scalar probe were
invalid: one splatted the safe-directory path as a Git subcommand, and one
specified the Windows `NUL` device as a Git exclude file. Neither produced
repository evidence.

## Impact

The invalid commands changed no files, Git configuration, provider state, or
private data. Their outputs were discarded.

## Cause classification

- **Confirmed cause:** PowerShell argument-array construction and Git's
  `core.excludesFile` contract were misapplied in the probe wrapper.
- **Rejected hypothesis:** The repository itself was not implicated; the
  command failed before a useful scalar result was collected.

## Correction and prevention

- Use explicit command-scoped `git -c "safe.directory=<exact-worktree>" -c
  "core.excludesFile=" ...` arguments.
- Validate the exit/result shape before treating a scalar probe as evidence.

## Verification

The corrected read-only probe returned branch `codex/phase-b-foundation`, the
existing short commit, a status count, and zero open incident rows. The docs
check also passed; no provider action occurred.

## Owner

Codex and project owner.
