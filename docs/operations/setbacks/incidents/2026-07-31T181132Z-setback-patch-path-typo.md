# SB-20260731-181132-setback-patch-path-typo: Setback patch mistyped the Windows user directory

- **Status:** closed
- **First observed:** 2026-07-31T18:11:32.0116919Z
- **Last observed:** 2026-07-31T18:11:32.0116919Z
- **Phase/task:** Phase B Task 3 setback-ledger update
- **Environment:** Local filesystem patch
- **Version/commit:** 5d0946b plus verified lifecycle edits

## Symptom

The first attempt to record the command-composition incident targeted a path
under `200i` instead of the verified `2006i` user directory. The patch failed
verification because the target path did not exist.

## Impact

The patch was rejected before writing either file. No code, provider,
environment, network, secret, staging, or commit was changed.

## Cause classification

- **Confirmed cause:** A manual character omission in the absolute patch path.
- **Hypotheses:** None remaining.
- **Known exclusions:** The intended worktree path and ledger files remain
  available.

## Correction and prevention

- **Correction:** Reapply the atomic ledger update using the exact verified
  worktree path.
- **Prevention:** Reuse the full known worktree root without manual shortening
  when constructing absolute patch targets.
- **Owner:** Codex.
- **Next diagnostic step:** None; the corrected path is known.

## Recurrence history

- 2026-07-31T18:11:32.0116919Z: Observed, contained, and closed before any
  write.
