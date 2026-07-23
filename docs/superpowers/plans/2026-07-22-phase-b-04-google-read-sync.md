# Vision Phase B Google Read Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the connected Vision calendar into PostgreSQL near real time, safely repair missed signals, and preserve Vision-only metadata through provider rebuilds.

**Architecture:** Google notifications enqueue opaque work; a deduplicating queue consumer performs paginated incremental sync and commits the next token only with the full change set. A scheduled 15-minute repair invokes the same sync path, while a projection reconciler handles invalid tokens without deleting Vision-owned annotations.

**Tech Stack:** Google Calendar API, Hono webhooks, Cloudflare Queues and scheduled Workers, Neon/Drizzle, Zod, Vitest Workers pool.

## Global Constraints

- A push notification is only a change signal; never trust it as event content.
- Verify channel ID, channel token, resource identity, connected calendar, and channel lifecycle.
- Queue payloads contain opaque IDs only.
- Treat delivery as at-least-once and make all consumers idempotent.
- Commit a new sync token only after every response page and database mutation succeeds.
- Preserve deleted provider tombstones and invalidate derived records transactionally.
- Run scheduled repair every 15 minutes and renew channels before expiration.
- On `410 Gone`, rebuild only Google-backed projection state and preserve Vision categories, annotations, and relationships.
- Revoked authorization stops sync and reports `Disconnected`.
- Phase B does not call Google event create, update, move, cancel, or delete methods.
- For every production file and named function, maintain concise `docs/reference/simple/` and in-depth `docs/reference/technical/` entries at mirrored paths; document meaningful folders with `_folder.md` in both trees.
- Require module/function JSDoc, comment non-obvious idempotency and provider invariants, and run `pnpm docs:check` before every task commit.

---

### Task 1: Define provider-neutral sync contracts

**Files:**
- Create: `src/domain/sync/change.ts`
- Create: `src/domain/sync/checkpoint.ts`
- Create: `src/integrations/google-calendar/event-mapper.ts`
- Test: `tests/unit/domain/sync.test.ts`
- Test: `tests/contract/google/event-mapper.contract.test.ts`

**Interfaces:**
- Produces: `ProviderEventChange = UpsertEvent | DeleteEvent`.
- Produces: `SyncCheckpoint { calendarId; syncToken; committedAt; version }`.
- Produces: `mapGoogleEvent(raw): ProviderEventChange`.

- [ ] **Step 1: Write recurrence, deletion, and privacy mapping tests**

Use sanitized Google fixtures for normal event, all-day event, recurring master, exception, cancelled occurrence, deleted event, attendees, conference link, and unknown future fields. Assert provider identity and time fields remain queryable, protected text lands only in protected fields, attachments are recorded as references but not copied, and no Vision category is read from Google extended properties.

Run: `pnpm exec vitest run tests/unit/domain/sync.test.ts tests/contract/google/event-mapper.contract.test.ts`

Expected: FAIL because sync types and mapper do not exist.

- [ ] **Step 2: Implement strict provider translation**

Validate provider input with permissive passthrough only at the raw boundary, then create a closed provider-neutral result. Normalize timestamps to instants plus original timezone, retain recurrence/master identity, and represent deletions explicitly. Put title, description, location, attendees, and meeting links in the protected payload passed to the encrypted repository.

- [ ] **Step 3: Verify pure mapping**

Run: `pnpm exec vitest run tests/unit/domain/sync.test.ts tests/contract/google/event-mapper.contract.test.ts`

Expected: all fixture mappings pass.

- [ ] **Step 4: Commit sync contracts**

```powershell
git add src/domain/sync src/integrations/google-calendar/event-mapper.ts tests/unit/domain tests/contract/google
git commit -m "feat: define Google event projection contracts"
```

### Task 2: Implement paginated incremental synchronization

**Files:**
- Create: `src/integrations/google-calendar/event-sync-client.ts`
- Create: `src/jobs/sync-calendar.ts`
- Create: `src/data/repositories/sync-repository.ts`
- Modify: `src/data/repositories/event-repository.ts`
- Test: `tests/contract/google/incremental-sync.contract.test.ts`
- Test: `tests/integration/jobs/sync-calendar.test.ts`

**Interfaces:**
- Produces: `EventSyncClient.listChanges({ calendarId, pageToken?, syncToken? })`.
- Produces: `syncCalendar({ ownerId, calendarId, reason, jobId }): SyncResult`.
- Guarantees: checkpoint and event projection commit atomically after the final page.

- [ ] **Step 1: Write multi-page and partial-failure tests**

Test initial full sync, two-page incremental sync, deletion, duplicate page content, transient provider error on page two, database failure before checkpoint commit, rerun after failure, and an unchanged response. Assert page-two failure leaves the old sync token and no half-applied projection.

Run: `pnpm exec vitest run tests/contract/google/incremental-sync.contract.test.ts tests/integration/jobs/sync-calendar.test.ts`

Expected: FAIL because the sync job does not exist.

- [ ] **Step 2: Implement transactional sync**

Load the committed checkpoint, page until `nextPageToken` is absent, map and stage every change, then apply staged changes plus invalidations and `nextSyncToken` in one repository transaction. Use stable provider identity for upsert/delete. Record result counts, duration, and reason without protected content.

- [ ] **Step 3: Add bounded retries**

Retry Google `429` and `5xx` with exponential backoff and jitter through queue redelivery, not an unbounded loop inside one Worker request. Mark authorization errors disconnected and schema errors action-required. Never advance the checkpoint on any failure.

- [ ] **Step 4: Verify incremental semantics**

Run: `pnpm exec vitest run tests/contract/google/incremental-sync.contract.test.ts tests/integration/jobs/sync-calendar.test.ts`

Expected: all cases pass, including old-token preservation on page-two failure.

- [ ] **Step 5: Commit incremental sync**

```powershell
git add src/integrations/google-calendar src/jobs src/data/repositories tests/contract/google tests/integration/jobs
git commit -m "feat: add transactional calendar synchronization"
```

### Task 3: Add verified webhook ingestion and queue deduplication

**Files:**
- Create: `src/server/webhooks/google-calendar.ts`
- Create: `src/jobs/queue-message.ts`
- Create: `src/jobs/queue-consumer.ts`
- Create: `src/data/repositories/job-repository.ts`
- Modify: `src/worker.ts`
- Modify: `wrangler.jsonc`
- Test: `tests/worker/google-webhook.test.ts`
- Test: `tests/integration/jobs/queue-deduplication.test.ts`

**Interfaces:**
- Produces: `POST /webhooks/google/calendar`.
- Produces: `CalendarSyncMessage { jobId; ownerId; calendarId; reason }` with opaque values.
- Produces: queue `consumer(batch, env, ctx)`.

- [ ] **Step 1: Write forged and duplicate delivery tests**

Test missing headers, wrong channel, wrong channel token, wrong resource ID, expired channel, valid `sync` signal, valid `exists` signal, duplicate HTTP signal, duplicate queue delivery, retryable error, and permanent error. Assert invalid signals enqueue nothing and valid endpoints return promptly without fetching events inline.

Run: `pnpm exec vitest run tests/worker/google-webhook.test.ts tests/integration/jobs/queue-deduplication.test.ts`

Expected: FAIL because webhook and consumer are absent.

- [ ] **Step 2: Implement channel verification and opaque enqueue**

Resolve the channel by hashed channel token plus ID, constant-time compare the secret token, validate resource identity and expiry, then create a stable job deduplication key. Queue only owner/calendar/job/reason opaque values. Respond `204` after durable enqueue.

- [ ] **Step 3: Implement idempotent queue consumption**

Claim the job in PostgreSQL, call `syncCalendar`, mark completion with checkpoint/result metadata, acknowledge on success/permanent no-op, and retry transient failures. After the configured maximum, write a failed-job record and expose `Action required`.

- [ ] **Step 4: Verify webhook and duplicate behavior**

Run: `pnpm exec vitest run tests/worker/google-webhook.test.ts tests/integration/jobs/queue-deduplication.test.ts`

Expected: all tests pass and duplicate delivery results in one synchronization effect.

- [ ] **Step 5: Commit webhook and queue path**

```powershell
git add src/server/webhooks src/jobs src/data/repositories src/worker.ts wrangler.jsonc tests/worker tests/integration/jobs
git commit -m "feat: ingest Google change notifications"
```

### Task 4: Add channel lifecycle and 15-minute repair

**Files:**
- Create: `src/jobs/renew-google-channels.ts`
- Create: `src/jobs/repair-calendar-sync.ts`
- Create: `src/jobs/scheduled.ts`
- Modify: `src/integrations/google-calendar/calendar-client.ts`
- Modify: `src/worker.ts`
- Modify: `wrangler.jsonc`
- Test: `tests/unit/jobs/channel-renewal.test.ts`
- Test: `tests/integration/jobs/repair-sync.test.ts`

**Interfaces:**
- Produces: `renewExpiringChannels(now)`.
- Produces: `repairCalendarSync(now)`.
- Produces: Worker scheduled handler on `*/15 * * * *`.

- [ ] **Step 1: Write schedule and rollover tests**

Test early renewal window, new-channel verification before old-channel stop, failed renewal preserving the old channel, expired channel, duplicate scheduled invocation, and a deliberately missed notification repaired by the scheduled job.

Run: `pnpm exec vitest run tests/unit/jobs/channel-renewal.test.ts tests/integration/jobs/repair-sync.test.ts`

Expected: FAIL because scheduled jobs are absent.

- [ ] **Step 2: Implement safe channel rollover**

Create a random channel ID and token, store only a token hash plus encrypted recovery value if required, call Google watch, persist resource ID and expiration, verify the new record, then stop and retire the previous channel. Surface prolonged renewal failure as `Action required`.

- [ ] **Step 3: Implement scheduled repair through the normal queue**

The cron handler lists connected calendars whose last successful sync is older than the repair threshold and enqueues deduplicated `scheduled-repair` messages. It does not fetch events inside the scheduler.

- [ ] **Step 4: Verify repair timing**

Run: `pnpm exec vitest run tests/unit/jobs/channel-renewal.test.ts tests/integration/jobs/repair-sync.test.ts`

Expected: the missed-signal fixture is repaired by the first eligible 15-minute run.

- [ ] **Step 5: Commit channel and repair jobs**

```powershell
git add src/jobs src/integrations/google-calendar src/worker.ts wrangler.jsonc tests/unit/jobs tests/integration/jobs
git commit -m "feat: repair and renew calendar synchronization"
```

### Task 5: Preserve Vision metadata during invalid-token rebuild

**Files:**
- Create: `src/jobs/rebuild-google-projection.ts`
- Create: `src/data/repositories/projection-repository.ts`
- Test: `tests/integration/jobs/rebuild-google-projection.test.ts`
- Modify: `src/jobs/sync-calendar.ts`

**Interfaces:**
- Produces: `rebuildGoogleProjection(ownerId, calendarId): RebuildResult`.
- Guarantees: provider projection may be replaced; Vision-only category/annotation/edge records survive and reattach by deterministic provider identity.

- [ ] **Step 1: Write the `410 Gone` preservation test**

Seed a synced event with explicit personal category, encrypted annotation, and Vision relationship. Simulate `410`, full provider listing, one changed event, one deleted event, and one new event. Assert the category, annotation, and relationship remain attached to the unchanged provider identity; deleted provider content becomes a tombstone; no Vision-only record is discarded.

Run: `pnpm exec vitest run tests/integration/jobs/rebuild-google-projection.test.ts`

Expected: FAIL because rebuild behavior is absent.

- [ ] **Step 2: Implement staged projection replacement**

Create a rebuild generation, stream the full Google listing into staged rows, reconcile by `(provider, calendarId, eventId, recurrenceIdentity)`, atomically activate the new generation and checkpoint, and then retire obsolete provider payloads. Preserve Vision-owned node metadata and edges outside the provider payload generation.

- [ ] **Step 3: Verify rebuild and full sync milestone**

Run:

```powershell
pnpm exec vitest run tests/contract/google tests/worker/google-webhook.test.ts tests/integration/jobs
pnpm check
```

Expected: all sync, duplicate, repair, revoked-access, and invalid-token cases pass.

- [ ] **Step 4: Commit rebuild behavior**

```powershell
git add src/jobs src/data/repositories tests/integration/jobs
git commit -m "feat: rebuild invalid Google projections safely"
```

## Milestone verification

After approval to use preview resources, connect a disposable calendar, record an initial sync, create/edit/delete conspicuous test events in Google, and measure their appearance in Vision. Disable one notification delivery and prove the next scheduled repair imports the change. Revoke the test token and prove status becomes disconnected. Force an invalid token in the isolated checkpoint and prove Vision metadata survives rebuild. Clean up the disposable calendar and record non-sensitive results.
