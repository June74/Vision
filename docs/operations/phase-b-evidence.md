# Phase B completion evidence

**Status:** In progress  
**Branch:** `codex/phase-b-foundation`  
**Environment:** Local clean checks plus live preview  
**Evidence rule:** A gate remains pending until its required live exercise has
fresh evidence.

This file contains no credentials, database URLs, OAuth codes, tokens,
encryption keys, emails, protected calendar content, object keys, branch
identifiers, or provider-controlled URLs.

## Completion-gate map

| Phase B gate | Automated evidence | Live evidence | Status |
|---|---|---|---|
| Google access restricted to the approved private owner | `tests/contract/google/oauth.contract.test.ts`, `tests/integration/data/auth-admission.test.ts`, `tests/worker/auth.test.ts` | Real OAuth admission and session persistence succeeded; a fresh wrong-account denial still needs capture | Pending |
| Vision calendar created or connected only after confirmation | `tests/unit/domain/calendar-setup.test.ts`, `tests/contract/google/calendar-setup.contract.test.ts`, `tests/worker/calendar-setup.test.ts`, `tests/e2e/auth-setup.spec.ts` | Real secondary calendar connected and verified with zero events | Pass |
| Normal calendar changes synchronize near real time | `tests/contract/google/incremental-sync.contract.test.ts`, `tests/integration/jobs/sync-calendar.test.ts`, `tests/integration/jobs/sync-repository.test.ts` | Fresh provider change-to-Vision timing capture required | Pending |
| Deliberately missed notification is repaired | `tests/integration/jobs/repair-sync.test.ts` | Fresh missed-signal repair exercise required | Pending |
| PostgreSQL preserves identity, category, privacy, provenance, and governed relationships | `tests/contract/data/graph-repository.contract.test.ts`, `tests/unit/domain/identity.test.ts`, `tests/unit/domain/category.test.ts`, `tests/unit/domain/graph.test.ts`, repository integration suites | Live preview schema and synchronized-row aggregate checks required | Pending |
| Protected content absent from raw storage and logs | `pnpm security:scan`, `tests/security/protected-sentinel.test.ts`, release evidence fixtures | Live raw-row, safe-log, and encrypted-object sentinel checks required | Pending |
| Duplicate, stale, revoked-access, invalid-token, and uncertain-outcome cases pass | Queue, synchronization, OAuth, and concurrency unit/integration/contract suites | Revoked authorization requires a fresh live exercise; the rest have current automated evidence | Pending |
| Encrypted backup restore succeeds | Backup round-trip, daily-job, retention, corruption, and restore-guard suites | See `restore-drill.md` | In progress |
| Operational state accurately exposes delayed, failed, action-required, and disconnected conditions | `tests/unit/domain/health.test.ts`, `tests/worker/diagnostics.test.ts`, `tests/e2e/foundation-diagnostics.spec.ts` | Fresh live failure exercises required | Pending |
| Measured usage remains compatible with approximately $20/month | Deterministic 800/900/950-cent AI budget tests | See `cost-review.md`; live OpenAI/Gateway evidence remains | In progress |
| No event-level Google write is enabled | `tests/security/google-write-surface.test.ts`, `pnpm security:scan` | Generated preview artifact and live route/UI inspection show no event mutation controls | Pass |

## Current verification record

| Timestamp UTC | Commit | Environment | Verification | Result |
|---|---|---|---|---|
| 2026-07-26 | `066fcbd` | Local | `pnpm check` | Pass: 610 unit/integration passed, 1 skipped; 179 contract passed; 75 Worker passed; docs, build, and security scan passed |
| 2026-07-26 | `066fcbd` | Guarded preview workflow | Application checks, browser smoke, generated configuration validation, deploy | Pass |
| 2026-07-26 | `066fcbd` | Live preview | Health endpoint and unauthenticated application shell | HTTP 200 and expected safe UI |
| 2026-07-26 | `3935500` | Local | `pnpm test:e2e` | Pass: 29 browser tests |
| 2026-07-26 | `3935500` | Live preview | Temporary every-minute recovery trigger | Failed closed: no object; read-only schema check confirmed 11 required tables and nine migration signature columns absent |
| 2026-07-26 | `67af8e8` | Guarded preview workflow and live trigger settings | Restore normal daily recovery cadence | Pass: guarded workflow succeeded; `5 6 * * *` and maintenance cadence present; temporary every-minute trigger absent |
| 2026-07-26 | `9f5a0d5` plus local preflight | Disposable local PostgreSQL-compatible database | Apply migrations 0004-0009 atomically, force a rollback, and verify direct privileges | Pass: zero missing required tables, zero missing signature columns, forced rollback removed migration-0004 tables, expected `vision_app` grants matched on 13 tables, and `PUBLIC` had zero affected-table grants |
| 2026-07-26 | `9620e06` | Local | Updated application and release gates | Pass: 611 unit/integration/security tests with one intentional skip; 179 contract; 75 Worker; 29 browser; TypeScript, docs, production build, release security scan, and diff checks passed |
| 2026-07-26 | `6a14659` plus authorized live operation | Preview Neon | Apply reviewed migrations 0004-0009 as one transaction and verify post-0009 signature | Pass: staged transaction matched the reviewed source by exact character count and SHA-256; all eleven required tables and all nine required columns were present afterward |
| 2026-07-26 | `ffb3c0a` plus authenticated provider inspection | Preview Worker and private R2 | Run post-migration scheduled backup and verify safe stored-object facts | Pass: safe tail returned no failure, exactly one current-date encrypted object was present, and format, key version, date, and ciphertext-digest shape matched the contract |

The live preview schema is current through migration 0009. The normal daily
schedule remains deployed while a fresh encrypted backup and disposable
restore drill proceed.

## Release decision

**Not complete yet.** The live database is current. The backup/restore,
synchronization timing and repair, live failure states,
wrong-account/revocation privacy checks, and OpenAI cost-path acceptance still
need fresh evidence.
