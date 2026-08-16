# SB-20260812-094617 — Wrangler build log write denied

- **Status:** contained
- **Detected:** 2026-08-12T09:46:17Z
- **Area:** Phase B preview observability configuration verification
- **Symptom:** The production build exited zero, but Wrangler reported an `EPERM` while attempting to write its optional user-level debug log under the host profile.
- **Impact:** The application and generated artifacts were produced successfully; no provider, deployment, secret, database, or source state changed.
- **Correction:** Treat the build exit status and generated artifact as authoritative, avoid reading the optional debug log, and use the preview build environment explicitly before artifact inspection.

## Recurrence - 2026-08-16

At 2026-08-16T15:10:51Z, the Phase C Worker verification again emitted the
same optional user-level Wrangler log-write `EPERM` while the test command
completed successfully. The warning remained local-only; no provider,
deployment, secret, database, or source state changed.

At 2026-08-16T15:11:54Z, the repository-configured Worker suite reproduced
the same log-write warning while passing all 116 assertions. No provider,
deployment, secret, database, or source state changed.

At 2026-08-16T15:12:56Z, the production client and Worker build completed
successfully while Wrangler emitted the same optional log-write `EPERM`. The
generated artifacts and crypto-boundary check remained valid; no provider,
deployment, secret, database, or source state changed.
