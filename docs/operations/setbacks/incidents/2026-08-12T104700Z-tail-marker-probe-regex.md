# SB-20260812-104700 — Tail marker probe was blocked by shell regex quoting

- **Status:** contained
- **Detected:** 2026-08-12T10:47:00Z
- **Area:** Phase B observability credential diagnosis
- **Symptom:** A read-only in-memory tail marker probe stopped in Node before spawning Wrangler because PowerShell quoting changed a regular-expression literal into invalid JavaScript.
- **Impact:** No provider request or Worker mutation occurred; the preceding null-safe probe had already shown the local tail stayed connected and the health request returned HTTP 200, but this follow-up marker classification was discarded.
- **Next action:** Use string-based `includes` checks in the bounded probe instead of regex literals when passing JavaScript through PowerShell.
