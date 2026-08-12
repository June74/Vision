# SB-20260812-093800 — Browser tab summary used invalid async formatting

- **Status:** contained
- **Detected:** 2026-08-12T09:38:00Z
- **Area:** Phase B Cloudflare observability diagnosis
- **Symptom:** A read-only browser-tab summary attempted to use `await` inside a non-async formatter and failed before tab inspection.
- **Impact:** No tab navigation, browser interaction, provider state, or project state changed.
- **Correction:** Fetch the tab URL first, then derive only its host in a separate synchronous formatter.

