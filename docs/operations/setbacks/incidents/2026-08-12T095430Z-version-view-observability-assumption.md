# SB-20260812-095430 — Version view does not expose observability fields

- **Status:** contained
- **Detected:** 2026-08-12T09:54:30Z
- **Area:** Phase B post-deploy observability verification
- **Symptom:** A read-only `wrangler versions view --json` inspection assumed the response would include the deployed observability configuration. The response shape omits that field, so the resulting `false` booleans were not an authoritative setting check.
- **Impact:** No provider state changed and no conclusion about the deployed setting was accepted.
- **Correction:** Verify observability behavior through a live privacy-safe tail and, if needed, the dashboard/settings API—not by inferring absence from the version view schema.

