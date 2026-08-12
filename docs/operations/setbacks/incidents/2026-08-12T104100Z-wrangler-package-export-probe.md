# SB-20260812-104100 — Direct Wrangler probe used a non-exported package subpath

- **Status:** contained
- **Detected:** 2026-08-12T10:41:00Z
- **Area:** Phase B observability credential diagnosis
- **Symptom:** The null-safe Node probe stopped before spawning Wrangler because this Wrangler package does not export `./bin/wrangler.js` through its package `exports` map.
- **Impact:** No Wrangler process or provider request started; no external state changed.
- **Root cause:** The probe used a package subpath instead of resolving the package manifest and joining its declared binary path.
- **Next action:** Resolve the package manifest first, then invoke the declared binary path with the same bounded in-memory capture.
