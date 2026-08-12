# SB-20260812-093048 — Maintenance result wrapper failed after observer completion

- **Status:** contained
- **Detected:** 2026-08-12T09:30:48Z
- **Area:** Phase B calendar-maintenance uniqueness acceptance
- **Symptom:** The 09:30 privacy-safe observer completed, but the surrounding PowerShell wrapper used an invalid inline conditional expression while summarizing and deleting its temporary capture.
- **Impact:** The observer's safe result was not surfaced by that command and the temporary local capture required bounded cleanup. No raw provider data was printed and no external state changed.
- **Correction:** Recover only output presence/exit facts from the bounded local capture, delete it explicitly, and use a normal PowerShell variable assignment for conditional values in future wrappers.

