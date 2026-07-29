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
| 2026-07-26 | `d7da15d` | Guarded preview workflow and live trigger settings | Restore normal daily recovery cadence after backup acceptance | Pass: complete checks and browser smoke passed; `5 6 * * *` and maintenance cadence are deployed; the temporary every-minute trigger is absent |
| 2026-07-26 | Authorized live operation | Disposable schema-only Neon branch | Create isolated restore target and provision database-owned migration-9 attestation | Pass: one additional branch is listed, and an independent assertion query completed successfully without exposing the branch identifier |
| 2026-07-27 | `a433912` | Guarded preview operator workflow | Verify the saved global AI Gateway budget using read-only detail inspection | Pass: exactly one enabled, unscoped $9.50 fixed 30-day cost rule matched; no update or deployment job ran |
| 2026-07-27 | `50569e6` | Local clean-room verification | Frozen install, TypeScript, unit/integration/security, contract, Worker, browser, docs, build, and release scan | Pass: 627 unit/integration/security tests with one intentional skip; integration-only subset 243 with one skip; 179 contract; 75 Worker; 29 browser; documentation, production build, security scan, and diff checks passed |
| 2026-07-27 | Current live preview | Authenticated private desk | Reload session, status rail, synchronized-event list, queue retry count, AI allowance, and event-write control inspection | Pass: private desk loaded after a fresh page open; state was `Healthy`, last synchronization was within 15 minutes, queue retries were zero, the synchronized-event count was zero, AI showed $0.00 of $9.50, and no event create/edit/move/cancel/delete control was present |
| 2026-07-27 | `a2bbc80` | Guarded preview workflow | Capture one privacy-safe scheduled outcome without deployment or configuration work | Diagnostic only: workflow passed and every mutation job was skipped, but the classifier accepts only recovery crons and returned `no_scheduled_event`; this does not prove the 15-minute calendar-maintenance path |
| 2026-07-28 | Task 1 candidate | Local | Permanent calendar-maintenance evidence, strict safe-tail classification, and immutable-ref observer policy | Pass: 755 unit/integration tests with one intentional skip, 179 contract tests, 75 Worker tests, TypeScript, documentation, build, and security scan |
| 2026-07-29 | Task 6 candidate | Local | Generated candidate isolation, exact operator selection, same-run AI attestation, separate rollback, security scans, and permanent cleanup contract | Pass: typecheck; 1,017 unit/integration/security tests with two intentional skips; 179 contract; 94 Worker; documentation, build, normal preview artifact validation, release security scan, zero migration diff, and zero secret-inventory diff. Fresh live exercises remain pending |
| 2026-07-29 | `d4de4de` | Local Task 7 freeze | Full focused and aggregate gates, generated normal/foundation/AI/six-fault candidate matrix, safe-tail observer shapes, workflow/client/secret checks, and pre-cleanup residue contract | Pass with a documented plan-wording concern: 1,040 unit/integration/security tests with one intentional skip; 179 contract; 94 Worker; 35 browser; TypeScript, documentation, build, release security scan, normal preview validation, eight generated candidates, nine exact printer shapes, zero migration diff, and zero acceptance-range production delete-call additions. Strict future cleanup mode remains intentionally RED for exactly 48 dedicated and 34 shared temporary paths. No live acceptance or provider mutation was performed |
| 2026-07-29 | Pending post-push identifier | Local final-fix wave 2 | Parser-backed workflow reachability, post-restore closure, exact AI pricing policy, full-lifetime recovery exclusion, expanded Task 8 inventory, explicit preview/production artifact validation, and nondeploy dry-runs | Pass: 1,170 unit/integration/security tests with one intentional skip; 179 contract; 94 Worker; 35 browser; TypeScript, documentation, build, release security scan, real YAML parsing, 40 immutable action references, preview and production build-validation-attestation-dry-run chains, eight generated candidates, 62 safe-tail assertions, zero migration paths, zero added Google event writes, zero added source delete calls, and exit-zero diff check. Strict cleanup remains intentionally RED while exactly 56 dedicated and 35 shared paths remain. No live acceptance, provider mutation, push, or deployment was performed |

The live preview schema is current through migration 0009. The normal daily
schedule remains deployed while a fresh encrypted backup and disposable
restore drill proceed.

## Live-acceptance instrumentation gaps

The four acceptance areas now have closed local instrumentation and generated
preview-only candidate routing, but each still needs its fresh live
observation:

- The 15-minute scheduler now emits one exact
  `vision.calendar-maintenance/v1` record after cleanup, repair, and renewal.
  The safe-tail observer checks out the workflow dispatch commit, proves the
  checkout equals `github.sha` before receiving provider credentials, retains
  its separate non-mutating concurrency group and bounded timeout, and accepts
  only that closed record on the exact normal cron. Candidate deployment
  repeats the exact workflow identity, commit, active status, and evidence
  family proof as the penultimate control, followed by an actual generated
  candidate lifetime check immediately adjacent to deploy. A fresh guarded
  preview capture is still required as live evidence.
- The dedicated foundation candidate emits only fixed booleans and aggregate
  counts through read-only, owner-scoped database/R2 boundaries. It needs a
  fresh guarded observer/candidate/rollback exercise.
- Diagnostics now measure database and R2 usage independently, and the
  dedicated AI candidate emits fixed-shape aggregate provider usage only after
  a same-run read-only Gateway-limit verification. All five pricing and
  reservation bindings must also exactly match the source-controlled policy in
  source configuration, generated artifacts, runtime parsing, and provider
  state. It needs one harmless live category request plus a fresh guarded
  capture and rollback.
- The six-value preview fault harness can exercise delayed Queue work, failed
  synchronization, channel expiry, database outage, R2 upload failure, and the
  AI budget stop. Each candidate is isolated behind one generated selector,
  one temporary schedule, an active observer proof, and a separate rollback;
  the live failure matrix remains pending.

The normal artifact contains only the two permanent schedules and no acceptance
binding. Each temporary candidate carries a canonical bounded deadline; its
complete maximum lifetime must avoid the protected recovery interval, and the
scheduler rechecks expiry and overlap against wall-clock execution time before
temporary dependency access, so delayed delivery cannot extend the lifetime.
Normal purge, permanent recovery, and cleanup behavior remain unchanged. After
the acceptance matrix, source cleanup must be reviewed, deployed, and verified
before any provider cleanup. The permanent cleanup contract names the exact 56
dedicated deletions plus 35 shared active-residue files spanning runtime
bindings, observer modes, routes, selectors, scheduler branches, references,
and tests. The dedicated inventory now includes the observer validator and
test, acceptance-window script and test, and both simple/technical references
for each validator. The shared inventory explicitly retains normal health
warnings, their tests, and the OAuth `database_unavailable` category. It also
retains recovery/import tooling, `backups/v1/`, key version 1, permanent
security scans, maintenance evidence, measured usage warnings, bounded observer
behavior, and historical plans, setbacks, credential history, and release
evidence.

Before every candidate, the guarded workflow requires live preview health,
exactly the two normal schedules, and an explicit provider binding array with
no temporary binding. Missing, null, malformed, or failed provider responses
fail closed. Rollback uses the same provider-state validator after deploying
the normal artifact, but restored normal state alone does not close the
lifecycle. A separate closure run must bind the normal commit, both provider
checks, and fresh signed-in diagnostics/calendar reads to the newest candidate.
Later candidates and cleanup remain blocked until that exact closure passes.

## Release decision

**Not complete yet.** The live database is current. The backup/restore,
synchronization timing and repair, live failure states,
wrong-account/revocation privacy checks, and OpenAI cost-path acceptance still
need fresh evidence.
