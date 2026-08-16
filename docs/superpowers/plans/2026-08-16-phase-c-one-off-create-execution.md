# Phase C One-Off Create Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute one confirmed one-off calendar-create proposal through target revalidation, idempotent provider creation, uncertain-result reconciliation, verified read-back, privacy-safe audit, and compensating undo.

**Architecture:** Keep the execution core provider-neutral and dependency-injected. Add a separate bounded Google Calendar adapter that translates the core port into fixed-origin Calendar API calls. Do not register HTTP/browser routes or deploy in this increment; the next server-composition increment will wire the tested core to durable operation storage and user confirmation.

**Tech Stack:** TypeScript, Zod, Vitest, the existing `CalendarWriteProposal`, the existing privacy-safe audit contract, and Google Calendar REST through `fetch`.

**Concurrency limit:** No more than 20 agents may be active at once. Execute inline with 0 active agents; do not dispatch parallel implementation agents.

---

## File map

- Create: `src/domain/calendar-write/create-execution.ts` — provider-neutral ports, results, create executor, and undo executor.
- Create: `tests/unit/domain/calendar-write-create-execution.test.ts` — stale, idempotency, uncertainty, read-back, audit, and undo tests.
- Create: `src/integrations/google-calendar/event-write-client.ts` — bounded Google events insert, marker lookup, get, and delete adapter.
- Create: `tests/contract/integrations/google-event-write-client.contract.test.ts` — request and response boundary tests with an injected fetcher.
- Create: `docs/reference/simple/src/domain/calendar-write/create-execution.md` — plain-language reference.
- Create: `docs/reference/technical/src/domain/calendar-write/create-execution.md` — signatures and invariants.
- Modify: both calendar-write folder guides, `docs/operations/phase-c-handoff.md`, and `PROJECT_PLAN.md`.

## Task 1: Define the execution-core RED tests

**Files:** `tests/unit/domain/calendar-write-create-execution.test.ts` and the
not-yet-created `src/domain/calendar-write/create-execution.ts`.

- [ ] **Step 1: Build a confirmed proposal fixture and fake ports.** Use the
  existing proposal factory and approval transition. The fake provider records
  every call and exposes a current calendar version, created event, and marker
  matches. The fake ledger records owner/operation state. The fake audit sink
  records submitted `SafeAuditEvent` values.
- [ ] **Step 2: Test stale target rejection.** A different current calendar
  version returns `invalidated`, writes a denied `calendar.event.create` audit
  with `calendar_target_stale`, performs no create, and claims no operation.
- [ ] **Step 3: Test verified create.** Matching version claims once, calls
  create once with the operation ID, reads back an exact event, records a
  succeeded audit, and returns a verified result with opaque undo metadata.
- [ ] **Step 4: Test verified replay.** A seeded verified ledger record is
  returned without reading the target or calling provider create.
- [ ] **Step 5: Test uncertain reconciliation.** An uncertain create followed
  by exactly one marker match reads back and verifies without inserting again;
  zero matches returns `verification_pending` and never retries insert.
- [ ] **Step 6: Test mismatch and undo.** A read-back field mismatch returns
  pending, not verified. A verified record can be deleted once with its
  expected provider version and becomes `undone` only after not-found read-back;
  an uncertain delete remains pending.
- [ ] **Step 7: Run the RED check.** Run
  `.\\node_modules\\.bin\\vitest.cmd run tests\\unit\\domain\\calendar-write-create-execution.test.ts`.
  The expected failure is the missing execution module. Fix only test-harness
  errors until that is the observed failure.

## Task 2: Implement the provider-neutral executor

**Files:** `src/domain/calendar-write/create-execution.ts` and the Task 1
test file.

- [ ] **Step 1: Add the port contracts.** Export these exact core types, with
  bounded opaque strings validated at the implementation boundary:

  `CalendarWriteProvider` exposes `readCalendarVersion(calendarId)`,
  `createOneOffEvent(input)`, `findByOperationId(input)`, `readEvent(input)`,
  and `deleteEvent(input)`. The event shape contains only event ID, provider
  version, approved title/description/times/timezone, operation ID, concrete
  domain/privacy, empty attendees, null recurrence, and `none` notifications.

  `CalendarWriteLedger` exposes `find(ownerId, operationId)`,
  `claim(ownerId, proposal)`, `markWriting`, `markPending`, `markVerified`,
  `markFailed`, `markUndone`, and stores only opaque event/version metadata.

  `CalendarWriteAudit` exposes `write(event: SafeAuditEvent): Promise<void>`.
  Provider failures use `CalendarWriteProviderError` with only
  `definite_failure` or `uncertain` outcomes.
- [ ] **Step 2: Add exact preview matching and safe-audit helpers.** Match
  title, description, start, end, timezone, operation marker, domain, privacy,
  attendee emptiness, recurrence null, and notifications none. Use only the
  controlled audit action/outcome/error categories already listed in the
  design; never format rejected values.
- [ ] **Step 3: Implement `executeConfirmedCalendarCreate`.** Enforce this
  order: confirmed status; latest target read; stale invalidation; owner-scoped
  ledger replay/reconciliation; one new claim; writing state; one provider
  create; uncertain marker lookup; one exact read-back; verified, pending, or
  failed ledger state; and one privacy-safe audit event.
- [ ] **Step 4: Implement `undoVerifiedCalendarCreate`.** Require a verified
  owner-scoped record, call delete once with event ID and expected version,
  read the event, return undone only on acknowledged delete or not-found, and
  leave uncertain or still-present results pending. An undone replay must not
  delete again.
- [ ] **Step 5: Run the focused tests GREEN.** Use the Task 1 command and
  confirm every execution test passes without provider or deployment output.

## Task 3: Define the Google adapter RED tests

**Files:** `tests/contract/integrations/google-event-write-client.contract.test.ts`
and the not-yet-created adapter.

- [ ] **Step 1: Test calendar version reads.** Require the fixed Google origin
  and `/calendars/{id}` path, bearer authorization, strict JSON with matching
  ID and nonempty ETag, and constant errors without response bodies.
- [ ] **Step 2: Test insert safety.** Require `POST
  /calendars/{id}/events?sendUpdates=none`, exact title/description/start/end/
  timezone fields, no attendees or recurrence, and private properties
  `vision.operationId`, `vision.domain`, and `vision.privacy`.
- [ ] **Step 3: Test marker lookup, read-back, and delete.** Require
  `privateExtendedProperty` marker filtering, strict one-off event parsing,
  `DELETE` with `If-Match`, and `sendUpdates=none`.
- [ ] **Step 4: Test outcome classification.** GET rejection is definite;
  POST/DELETE transport failure after mutation may be uncertain; malformed
  success payloads and timeouts are uncertain; no token, URL, or body crosses
  the error boundary.
- [ ] **Step 5: Run the adapter RED check.** Run
  `.\\node_modules\\.bin\\vitest.cmd run tests\\contract\\integrations\\google-event-write-client.contract.test.ts`.
  The expected failure is the missing adapter module.

## Task 4: Implement the bounded Google adapter

**Files:** `src/integrations/google-calendar/event-write-client.ts` and the
Task 3 contract test.

- [ ] **Step 1: Add fixed-origin request and bounded JSON helpers.** Reuse the
  existing deadline, media-type, byte-limit, and constant-error discipline from
  the read-only calendar adapter. Export no arbitrary-URL request method.
- [ ] **Step 2: Implement five methods.** Implement
  `readCalendarVersion`, `createOneOffEvent`, `findByOperationId`, `readEvent`,
  and `deleteEvent` with the exact URL, query, body, and header rules tested in
  Task 3. Convert only validated provider data into the provider-neutral event
  shape.
- [ ] **Step 3: Run adapter tests GREEN.** Run the Task 3 command and require
  all request, response, timeout, and error-boundary assertions to pass.

## Task 5: Document and update the handoff

**Files:** the two new reference files, both folder guides,
`docs/operations/phase-c-handoff.md`, and `PROJECT_PLAN.md`.

- [ ] **Step 1: Document the executor and adapter in plain language.** Define
  confirmation as deliberate approval, idempotency as duplicate prevention
  after a timeout, read-back as checking provider state, and
  `verification_pending` as an honest unknown result.
- [ ] **Step 2: Record the exact boundary.** Mark the execution core and
  adapter as locally implemented and verified; state that HTTP/browser wiring,
  durable ledger composition, and live acceptance are the next sub-increment.
- [ ] **Step 3: Run the docs check.** Run
  `.\\node_modules\\.bin\\tsx.cmd scripts\\validate-doc-coverage.ts` and
  require exit 0.

## Task 6: Full verification and narrow commits

- [ ] **Step 1: Run source and test TypeScript checks.** Run
  `.\\node_modules\\.bin\\tsc.cmd --noEmit` and
  `.\\node_modules\\.bin\\tsc.cmd --noEmit -p tests\\tsconfig.json`; both
  must exit 0.
- [ ] **Step 2: Run focused and full suites.** Run the two focused commands,
  `vitest run --project unit`, `vitest run --project contract`, and
  `vitest run --project worker`; require zero failing tests. Record known
  Wrangler linked-worktree warnings separately.
- [ ] **Step 3: Run release-boundary checks.** Run `vite build`, the production
  crypto-boundary validator, release-evidence capture, release scan, and
  `git diff --check`; run no provider or deployment command.
- [ ] **Step 4: Commit narrow changes.** Commit the execution test/core,
  adapter test/adapter, and documentation/handoff changes separately with
  messages `feat: add verified calendar create executor`,
  `feat: add Google event write adapter`, and
  `docs: record Phase C create execution core`.
- [ ] **Step 5: Verify the branch.** Run `git status --short`,
  `git branch --show-current`, and `git rev-parse HEAD`. The isolated Phase C
  branch must be clean. Do not push or deploy without explicit instruction.
