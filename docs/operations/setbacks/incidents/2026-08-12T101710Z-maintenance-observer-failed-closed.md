# SB-20260812-101710 — Scheduled maintenance observer failed closed after observability enablement

- **Status:** contained
- **Detected:** 2026-08-12T10:17:10Z
- **Area:** Phase B permanent maintenance baseline
- **Symptom:** The privacy-safe controller reached `observer_ready`, waited through the scheduled maintenance window, and terminated with `failed_closed` without accepting a uniquely correlated maintenance result.
- **Impact:** The live maintenance gate remains unproven. No deployment, rollback, database mutation, R2 mutation, Queue mutation, or secret change occurred during this read-only observation.
- **Likely boundary:** Cloudflare reports observability enabled, but the tail/controller path still did not expose an allowlisted scheduled maintenance event. The remaining possibilities are provider propagation/stream availability, schedule delivery, or correlation timing—not a basis for another blind retry.
- **Next action:** Inspect provider-side observability and schedule delivery state, then use one bounded read-only capture if needed. Do not alter credentials, rotate the backup key, or repeat the scheduled test without a known provider-side explanation.
