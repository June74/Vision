# SB-20260812-094617 — Wrangler build log write denied

- **Status:** contained
- **Detected:** 2026-08-12T09:46:17Z
- **Area:** Phase B preview observability configuration verification
- **Symptom:** The production build exited zero, but Wrangler reported an `EPERM` while attempting to write its optional user-level debug log under the host profile.
- **Impact:** The application and generated artifacts were produced successfully; no provider, deployment, secret, database, or source state changed.
- **Correction:** Treat the build exit status and generated artifact as authoritative, avoid reading the optional debug log, and use the preview build environment explicitly before artifact inspection.

