# SB-20260812-115011 — Incident inspection used a malformed worktree path

- **Status:** contained
- **Detected:** 2026-08-12T11:50:11Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A read-only PowerShell inspection of an existing incident failed before process creation because its worktree path was malformed.
- **Impact:** No repository, provider, deployment, or application state changed.
- **Resolution:** Continue using the validated absolute worktree path already used by the successful probes.
- **Prevention:** Keep the canonical worktree path in one copied variable and do not hand-edit it inside command strings.
