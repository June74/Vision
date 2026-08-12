# SB-20260812-085211 — Maintenance observer failed before evidence

- **Status:** contained
- **Detected:** 2026-08-12T08:52:11Z
- **Area:** Phase B calendar-maintenance uniqueness acceptance
- **Symptom:** The read-only maintenance controller reached `observer_ready`, but the GitHub Actions run failed in `Capture calendar_maintenance uniqueness` at `Print only allowlisted acceptance evidence`.
- **Safe evidence:** Checkout, commit admission, dependency installation, and authentication preflight succeeded. The job then exited nonzero while waiting for the scheduled maintenance signal; candidate deployment, rollback, cleanup, and provider mutation jobs were skipped.
- **Impact:** The permanent maintenance baseline is not yet proven. No secrets, calendar payloads, database data, or provider configuration were exposed or changed.
- **Likely boundary:** The tail observer did not receive one valid `vision.calendar-maintenance/v2` terminal record before the producer/session ended. This is a hypothesis pending a controlled local/provider reproduction.
- **Next action:** Reproduce the scheduled tail observation with the safe classifier only, verify whether the cron signal is emitted and whether the tail producer closes early, then change the narrowest failing contract and re-run the observer.

