# SB-20260812-093724 — Browser client path resolved from skill folder incorrectly

- **Status:** contained
- **Detected:** 2026-08-12T09:37:24Z
- **Area:** Phase B Cloudflare observability diagnosis
- **Symptom:** Browser initialization used the skill-folder path for the browser client instead of the plugin root path, so the module was not found.
- **Impact:** No browser session, provider state, or project files were changed by the failed initialization.
- **Correction:** Resolve the client from the plugin root's `scripts/browser-client.mjs` path before any browser action.

