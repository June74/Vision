# SB-20260812-103900 — Local tail probe wrapper mishandled empty capture

- **Status:** contained
- **Detected:** 2026-08-12T10:39:00Z
- **Area:** Phase B observability credential diagnosis
- **Symptom:** A read-only local Wrangler-tail probe returned empty capture files; the PowerShell wrapper passed a null value to byte counting and then could not immediately remove the two files while the child process still held them.
- **Impact:** The probe result was discarded and no provider state changed. The wrapper did not produce a trustworthy connectivity verdict.
- **Root cause:** The diagnostic wrapper did not normalize missing redirected output and assumed `Start-Process` had fully reaped the command tree after a forced stop.
- **Next action:** Use a null-safe bounded runner that tracks its own child process and reports only exit/count booleans; do not reuse this wrapper pattern.
