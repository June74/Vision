# SB-20260812-090113 — Maintenance observer missed its scheduled tick

- **Status:** contained
- **Detected:** 2026-08-12T09:01:13Z
- **Area:** Phase B calendar-maintenance uniqueness acceptance
- **Symptom:** The corrected observer was dispatched for the 09:00 UTC tick but reached `observer_ready` only at the boundary and then failed closed without evidence.
- **Impact:** The maintenance baseline remains unproven. No candidate deployment, rollback, secret change, database change, or provider configuration mutation occurred.
- **Correction:** Treat observer readiness as a hard pre-tick admission condition. Arm the next quarter-hour tick with the required lead time and retain the exact canonical scheduled instant.

