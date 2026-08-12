# SB-20260812-120457 — Focused test inspection used a malformed worktree path

- **Status:** contained
- **Detected:** 2026-08-12T12:04:57Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A read-only attempt to inspect the focused safe-tail test used a malformed worktree path and failed before process creation.
- **Impact:** No repository, provider, deployment, secret, database, or application state changed.
- **Resolution:** Reuse the validated absolute Phase B worktree path for focused test inspection.
- **Prevention:** Do not hand-edit the canonical Windows path in later commands.
