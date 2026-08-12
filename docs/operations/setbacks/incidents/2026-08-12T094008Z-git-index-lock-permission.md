# SB-20260812-094008 — Worktree Git index lock denied

- **Status:** contained
- **Detected:** 2026-08-12T09:40:08Z
- **Area:** Phase B setback-ledger publication
- **Symptom:** `git add` could not create the shared worktree index lock because the repository denied access.
- **Impact:** The setback ledger is saved in the working tree but not yet committed. No files were staged, and no application, provider, secret, or database state changed.
- **Correction:** Inspect the exact lock path and active process ownership before any cleanup; do not remove a lock blindly.

## Recurrence history

- 2026-08-12T18:54:49.872Z: A commit attempt again could not create the
  shared worktree index lock. No files were staged and no application,
  provider, secret, or database state changed; retry only after checking the
  exact lock path and active process ownership.
