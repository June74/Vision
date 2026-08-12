# SB-20260812-111906 — Diagnostic search used an unsupported recursion parameter

- **Status:** contained
- **Detected:** 2026-08-12T11:19:06Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A read-only PowerShell search passed `-Recurse` directly to `Select-String`, which does not support that parameter in this environment. The command stopped before reading repository content.
- **Impact:** No application, database, Worker, GitHub, or provider state changed.
- **Resolution:** Enumerate files with `Get-ChildItem` and pass the resulting paths to `Select-String`.
- **Prevention:** Use the workspace's Windows PowerShell search pattern instead of assuming cross-shell parameter support.
