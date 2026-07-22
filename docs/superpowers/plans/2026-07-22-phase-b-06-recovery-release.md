# Vision Phase B Recovery and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Vision can recover encrypted state, purge expired material, operate within the private-pilot budget, and satisfy every Phase B completion gate before handing Phase C to a new chat.

**Architecture:** A versioned logical backup exporter reads authoritative tables consistently, encrypts the archive with a backup-only key, and stores checksummed objects in R2 for 30 days. Release verification combines automated suites, approved preview exercises, storage/log scans, cost evidence, and a hard assertion that event-write routes remain disabled.

**Tech Stack:** Cloudflare R2 and scheduled Workers, Workers Web Crypto, Neon PostgreSQL, TypeScript operator scripts, Vitest, Playwright, GitHub Actions, Wrangler.

## Global Constraints

- Backups are encrypted with a separate backup key, not an application data key.
- Daily backups retain 30 days and then purge.
- A backup is not accepted until checksum, manifest, encryption envelope, and object metadata are verified.
- Restore drills target a disposable Neon branch and never overwrite production.
- Protected values must not appear in logs, audit, queue payloads, CI artifacts, or unencrypted R2 objects.
- Operational states must truthfully show delayed, failed, action-required, and disconnected conditions.
- Phase B may create the secondary Vision calendar but must expose no event insert/update/move/cancel/delete path.
- Measured managed-service usage must remain compatible with approximately $20 monthly.
- Do not declare Phase B finished without fresh evidence for every approved completion gate.
- At completion, provide the user a concise chat summary suitable for starting Phase C in a new chat.

---

### Task 1: Define versioned encrypted backup format

**Files:**
- Create: `src/domain/backup/manifest.ts`
- Create: `src/crypto/backup-envelope.ts`
- Create: `src/data/backup/export-backup.ts`
- Create: `src/data/backup/import-backup.ts`
- Test: `tests/unit/backup/manifest.test.ts`
- Test: `tests/integration/backup/round-trip.test.ts`

**Interfaces:**
- Produces: `BackupManifestV1 { format; createdAt; schemaVersion; rowCounts; plaintextSha256; keyVersion }`.
- Produces: `exportBackup(snapshot, backupKey): EncryptedBackup`.
- Produces: `importBackup(encrypted, backupKey, target): RestoreReport`.

- [ ] **Step 1: Write round-trip and corruption tests**

Seed nodes, edges, encrypted events, explicit categories, sync checkpoints, audit facts, deletion records, operation ledger, and usage ledger. Assert export bytes contain no `VISION_BACKUP_SENTINEL_31C2`, restore reproduces row counts and stable identities, wrong key/tampered object/checksum mismatch fail closed, and unsupported format/schema versions stop before writes.

Run: `pnpm exec vitest run tests/unit/backup/manifest.test.ts tests/integration/backup/round-trip.test.ts`

Expected: FAIL because backup modules do not exist.

- [ ] **Step 2: Implement canonical export and authenticated encryption**

Read a consistent database snapshot in deterministic table/key order, encode newline-delimited versioned records, hash the plaintext archive, create a manifest, and encrypt manifest plus archive with AES-GCM using a backup-only key and fresh IV. Do not decrypt already encrypted application fields during export.

- [ ] **Step 3: Implement validation-first restore**

Decrypt, validate envelope/manifest/schema/checksum, load into staging tables, verify references and row counts, then transactionally promote into an empty disposable target. Reject a non-empty target unless an explicit operator-only `--replace-disposable-target` flag and target environment assertion are present.

- [ ] **Step 4: Verify backup round trip**

Run: `pnpm exec vitest run tests/unit/backup/manifest.test.ts tests/integration/backup/round-trip.test.ts`

Expected: all round-trip and corruption tests pass.

- [ ] **Step 5: Commit backup format**

```powershell
git add src/domain/backup src/crypto/backup-envelope.ts src/data/backup tests/unit/backup tests/integration/backup
git commit -m "feat: add encrypted Vision backup format"
```

### Task 2: Add daily R2 backup, retention, and restore tooling

**Files:**
- Create: `src/jobs/create-daily-backup.ts`
- Create: `src/jobs/purge-expired-backups.ts`
- Create: `scripts/restore-backup.ts`
- Create: `docs/operations/backup-and-restore.md`
- Modify: `src/jobs/scheduled.ts`
- Modify: `src/server/env.ts`
- Modify: `wrangler.jsonc`
- Test: `tests/integration/jobs/daily-backup.test.ts`
- Test: `tests/integration/jobs/backup-retention.test.ts`

**Interfaces:**
- Produces: `createDailyBackup(now): BackupResult`.
- Produces: `purgeExpiredBackups(now): PurgeResult`.
- Produces: operator command `pnpm restore:backup -- --object <key> --target preview`.

- [ ] **Step 1: Write R2 idempotency and retention tests**

Test two invocations on one date, failed upload, metadata mismatch, a 29-day object, boundary 30-day object, 31-day object, malformed object name, wrong environment, and deletion retry. Assert one verified daily backup survives and only objects at or beyond the retention boundary purge.

Run: `pnpm exec vitest run tests/integration/jobs/daily-backup.test.ts tests/integration/jobs/backup-retention.test.ts`

Expected: FAIL because backup jobs do not exist.

- [ ] **Step 2: Implement R2 storage and verification**

Write to `backups/v1/YYYY/MM/DD/<opaque-id>.vision-backup`, store safe metadata containing format, created date, ciphertext SHA-256, and key version, then retrieve object metadata and checksum before marking the backup successful. Never include owner email or calendar content in object names or metadata.

- [ ] **Step 3: Implement retention and operator restore**

List only the fixed backup prefix, parse validated metadata, and delete expired objects idempotently. The restore script must require `target === "preview"`, a disposable-database confirmation phrase, and backup-key secret from process environment; it must print row counts/checksums only.

- [ ] **Step 4: Verify jobs and docs**

Run: `pnpm exec vitest run tests/integration/jobs/daily-backup.test.ts tests/integration/jobs/backup-retention.test.ts && pnpm typecheck`

Expected: all backup job tests pass.

- [ ] **Step 5: Commit scheduled recovery**

```powershell
git add src/jobs src/server/env.ts wrangler.jsonc scripts docs/operations package.json tests/integration/jobs
git commit -m "feat: schedule encrypted backup recovery"
```

### Task 3: Add privacy and write-surface release assertions

**Files:**
- Create: `tests/security/protected-sentinel.test.ts`
- Create: `tests/security/google-write-surface.test.ts`
- Create: `tests/security/secret-bundle.test.ts`
- Create: `scripts/scan-release.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm security:scan`.
- Guarantees: no protected sentinel in approved inspection surfaces and no event-write adapter method/route in Phase B.

- [ ] **Step 1: Write the release assertions**

The scanner must inspect built client assets, captured application logs, audit fixtures, queue fixtures, database raw-row exports, and unencrypted R2 fixtures for protected sentinels. It must inspect Google adapter calls and Worker route manifests for `events.insert`, `events.update`, `events.patch`, `events.move`, `events.delete`, create/update/move/cancel/delete event routes, and leaked secret binding names in the client bundle.

Run: `pnpm exec vitest run tests/security`

Expected: FAIL until the scanner and fixture collection exist.

- [ ] **Step 2: Implement allowlist-based scans**

Use explicit approved Google calls: OAuth/token, calendar list/get/insert for the one setup calendar, event list/get/watch/stop for reads, and no event mutation methods. Scan exact sentinel byte/string variants and URL/base64 encodings. Fail on unreadable expected evidence rather than silently skipping it.

- [ ] **Step 3: Integrate into CI**

Add `security:scan` to `pnpm check` and the protected production workflow. Store only a pass/fail summary and safe file identifiers as CI artifacts.

- [ ] **Step 4: Verify clean and deliberately contaminated fixtures**

Run the scanner against clean fixtures and expect success. Copy a sentinel into a temporary fixture and expect a nonzero exit. Add a forbidden event write call to a temporary adapter fixture and expect a nonzero exit. Remove both temporary contaminations and rerun successfully.

- [ ] **Step 5: Commit release assertions**

```powershell
git add tests/security scripts/scan-release.ts package.json .github/workflows
git commit -m "test: enforce Phase B privacy and write boundaries"
```

### Task 4: Execute the restore drill and cost/operations review

**Files:**
- Create: `docs/operations/restore-drill.md`
- Create: `docs/operations/cost-review.md`
- Create: `docs/operations/incident-runbook.md`
- Create: `docs/operations/phase-b-evidence.md`

**Interfaces:**
- Produces: reviewed non-secret evidence for restore, failure states, and cost compatibility.

- [ ] **Step 1: Obtain approval for live preview resources**

Request approval before creating or modifying the preview Neon branch, R2 bucket objects, Worker configuration, Google test channel/calendar, AI Gateway rule, or any spending limit. List each external action and expected cost impact.

- [ ] **Step 2: Perform a real encrypted backup and disposable restore**

Create the daily backup, verify R2 metadata/checksum, restore it into an empty disposable Neon branch, run schema/reference/row-count/sentinel checks, exercise event listing against restored state, and delete the disposable branch after recording its identifier and result.

- [ ] **Step 3: Exercise operational failure states**

In preview, simulate delayed queue, failed job, expired channel, revoked authorization, AI budget stop, database outage, and R2 upload failure. Confirm the actual UI/API reports `Delayed`, `Action required`, or `Disconnected` accurately and never reports false completion.

- [ ] **Step 4: Record measured cost compatibility**

Capture current monthly usage and projected cost for Workers, Neon compute/storage, R2 storage/operations, AI Gateway/OpenAI, and Google quota. Mark Phase B blocked if the projection exceeds approximately $20 or if a provider lacks the configured warning/limit described in the spec.

- [ ] **Step 5: Commit operational evidence**

```powershell
git add docs/operations
git commit -m "docs: record Phase B recovery evidence"
```

### Task 5: Run final Phase B acceptance and prepare Phase C handoff

**Files:**
- Modify: `docs/operations/phase-b-evidence.md`
- Create: `docs/operations/phase-c-handoff.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `docs/superpowers/specs/2026-07-22-phase-b-data-foundation-design.md`

**Interfaces:**
- Produces: one evidence mapping for every Phase B gate.
- Produces: concise Phase C handoff summary for a new chat.

- [ ] **Step 1: Run the full clean-room verification**

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm test:worker
pnpm exec vitest run tests/contract
pnpm exec vitest run tests/integration
pnpm test:e2e
pnpm security:scan
pnpm build
git diff --check
```

Expected: every command exits `0`; report exact counts and versions in the evidence file.

- [ ] **Step 2: Map evidence to all specification gates**

For each gate, record the test/preview action, timestamp, environment, result, and evidence location: allowlisted auth, exact calendar confirmation, normal near-real-time sync, deliberate missed-signal repair, graph identity/category/privacy/provenance, plaintext absence, duplicate/stale/revoked/invalid-token/uncertain-outcome behavior, successful restore, truthful operational states, cost ceiling, and disabled event writes.

- [ ] **Step 3: Update project status only after every gate passes**

Mark Phase B completed in `PROJECT_PLAN.md`, update the specification implementation status, and set Phase C as the next phase. If any gate lacks evidence, keep Phase B in progress and record the exact blocker instead.

- [ ] **Step 4: Write the new-chat handoff**

`docs/operations/phase-c-handoff.md` must summarize:

- Vision's product goal and single-user boundary.
- The approved stack and repository structure.
- Phase B services, migrations, routes, queues, schedules, encryption, and operational behavior actually delivered.
- Production/preview resources by non-secret identifier.
- Required local commands and secret names without values.
- Test and release evidence with commit hash.
- Known limitations and intentionally deferred features.
- Phase C's first objective: verified preview/confirmation/version-check/idempotent-write/audit/recovery pipeline for event create/edit/move/cancel/delete.
- The immutable Version 1 rule that connected writes always require exact confirmation.

- [ ] **Step 5: Commit and push the completion record**

```powershell
git add PROJECT_PLAN.md docs/superpowers/specs docs/operations
git commit -m "docs: complete Phase B foundation"
git push origin HEAD
```

- [ ] **Step 6: Notify the user and provide the chat summary**

Only after push and remote verification, tell the user Phase B is finished, link the evidence and handoff files, state the final commit, and paste a concise copy-ready summary for the new Phase C chat. Do not begin Phase C in this chat.

## Milestone verification

The milestone—and Phase B—passes only when the full verification command succeeds, the approved live preview exercises succeed, the encrypted restore drill succeeds, measured cost is compatible with the ceiling, the event-write surface scan is clean, local and remote commits match, and the user receives the Phase C handoff summary.
