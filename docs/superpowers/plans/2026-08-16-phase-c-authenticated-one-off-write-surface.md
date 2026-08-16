# Phase C Authenticated One-Off Write Surface Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Compose the verified Phase C one-off create executor into an authenticated browser loop that persists encrypted approvals, performs one durable idempotent create, verifies provider state, and supports a verified compensating undo.

**Architecture:** Keep the existing provider-neutral executor and bounded Google adapter as the only provider mutation path. Add separate encrypted approval and execution-ledger persistence, then compose them through an authenticated Hono route module using the existing session, CSRF, token, database, key, and audit boundaries. Add a narrow browser composer that only displays server-returned previews and operation status; it never supplies authority-bearing identities or provider versions.

**Tech Stack:** TypeScript, Hono, React, Zod, Drizzle ORM, Neon PostgreSQL, Web Crypto protected fields, Vitest, Playwright, the existing Google Calendar REST adapter, and the existing privacy-safe audit contract.

**Concurrency hardline:** No more than 20 agents at once. This is a hard line. Execute inline with 0 active agents; do not dispatch parallel implementation agents.

---

## File map

- Create: src/data/schema/calendar-write.ts — Drizzle declarations for encrypted approvals and execution ledger rows.
- Modify: src/data/schema/index.ts — export the Phase C calendar-write tables.
- Create: migrations/0010_phase_c_calendar_write_surface.sql — additive PostgreSQL migration for both tables and their ownership/status checks.
- Create: tests/contract/data/calendar-write-schema.contract.test.ts — migration and Drizzle-schema contract assertions.
- Create: src/data/repositories/calendar-write-repository.ts — approval-store and executor-ledger ports plus the production Drizzle/Neon implementation and strict decoders.
- Create: tests/unit/data/calendar-write-repository.test.ts — encryption, owner scope, compare-and-set, expiry, ledger claim, transition, and decoder tests.
- Create: src/server/api/calendar-write-routes.ts — authenticated preview/status/confirm/undo routes and production dependency resolver.
- Create: tests/worker/calendar-write.test.ts — injected Worker route tests covering the complete HTTP safety contract.
- Modify: src/worker.ts — inject and register the Phase C calendar-write routes before the API fallback.
- Create: src/client/calendar/writes/api.ts — browser-safe preview/status/confirm/undo client contract.
- Create: src/client/calendar/OneOffEventComposer.tsx — narrow one-off event form, immutable preview, confirmation, pending, and undo UI.
- Modify: src/client/App.tsx — compose the event composer only in the connected authenticated desk.
- Modify: src/client/styles.css — focused responsive styles for the composer and preview states.
- Create: tests/e2e/calendar-write.spec.ts — browser-path tests with provider-free route fixtures.
- Modify: tests/security/google-write-surface.test.ts and scripts/scan-release.ts — preserve the bounded provider and route allowlist.
- Create: docs/reference/simple/src/data/repositories/calendar-write-repository.md — plain-language repository reference.
- Create: docs/reference/technical/src/data/repositories/calendar-write-repository.md — persistence interfaces and invariants.
- Create: docs/reference/simple/src/server/api/calendar-write-routes.md — safe HTTP behavior reference.
- Create: docs/reference/technical/src/server/api/calendar-write-routes.md — route signatures, status mapping, and security boundary.
- Create: docs/reference/simple/src/client/calendar/OneOffEventComposer.md — browser behavior reference.
- Create: docs/reference/technical/src/client/calendar/OneOffEventComposer.md — client state and recovery contract.
- Modify: the relevant _folder.md reference guides, docs/operations/phase-c-handoff.md, and PROJECT_PLAN.md — coverage, handoff, and phase status.

## Execution rules

- Work only in C:\Users\2006i\OneDrive\Documents\AI calendar (secretary) project\.worktrees\phase-c-write-pipeline on codex/phase-c-write-pipeline.
- Do not push, deploy, call a live Google account, or alter live database state.
- Use direct local binaries such as .\node_modules\.bin\vitest.cmd, .\node_modules\.bin\tsc.cmd, and .\node_modules\.bin\tsx.cmd; do not use the registry-refreshing pnpm typecheck wrapper.
- For every production behavior, follow RED -> verify the expected failure -> GREEN -> verify the focused test -> refactor while green.
- Commit each coherent task after its focused verification. Never stage unrelated worktree changes.

## Task 1: Add the schema contract RED tests

Files: Create tests/contract/data/calendar-write-schema.contract.test.ts; create the not-yet-created schema and migration files.

- [ ] Step 1: Write the migration contract test first. Read migrations/0010_phase_c_calendar_write_surface.sql and assert the exact table names, encrypted proposal column, owner/provider/calendar columns, proposal_domain, status checks, expiry ordering check, paired provider event identity check, and additive-only behavior.

~~~ts
it("defines additive owner-scoped approval and execution tables", () => {
  const sql = readFileSync(resolve(process.cwd(), "migrations/0010_phase_c_calendar_write_surface.sql"), "utf8").toLowerCase();
  expect(sql).toContain("create table calendar_write_approvals");
  expect(sql).toContain("proposal_envelope bytea");
  expect(sql).toContain("check (status in ('proposed', 'confirmed', 'invalidated'))");
  expect(sql).toContain("create table calendar_write_operations");
  expect(sql).toContain("check (status in ('writing', 'verification_pending', 'verified', 'failed', 'undone'))");
  expect(sql).toContain("check ((provider_event_id is null) = (provider_event_version is null))");
  expect(sql).not.toContain("drop table");
});
~~~

- [ ] Step 2: Add the Drizzle manifest assertions. Use the existing extractDrizzleTablesManifest helper and import both new tables. Assert that approvals include operation_id, owner_id, provider, calendar_id, proposal_domain, status, requested_at, expires_at, and proposal_envelope; assert that operations include operation_id, owner_id, provider, calendar_id, status, provider_event_id, provider_event_version, requested_at, and completed_at.

- [ ] Step 3: Run the schema RED check.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\contract\data\calendar-write-schema.contract.test.ts
~~~

Expected result: failure because the migration and Drizzle table module do not exist. Correct only test-harness errors until that is the observed missing-artifact failure.

- [ ] Step 4: Commit the RED test only.

~~~powershell
git add -- tests/contract/data/calendar-write-schema.contract.test.ts
git commit -m "test: define Phase C write schema contract"
~~~

## Task 2: Implement the additive approval and ledger schema

Files: Create src/data/schema/calendar-write.ts and migrations/0010_phase_c_calendar_write_surface.sql; modify src/data/schema/index.ts.

- [ ] Step 1: Implement the Drizzle approval table with operation_id primary key, owner_id, provider, calendar_id, proposal_domain, status, requested_at, expires_at, and non-null proposal_envelope ciphertext. Add unique owner/operation identity and checks for non-empty owner/calendar, provider google, concrete proposal domain, the three approval statuses, and expiry after request.

- [ ] Step 2: Implement the Drizzle execution table with operation_id primary key, owner/provider/calendar identity, the five executor statuses, nullable paired provider_event_id/provider_event_version, requested_at, completed_at, owner/provider/operation uniqueness, and checks requiring provider identity/version together and requiring both for verified or undone rows.

- [ ] Step 3: Export the new tables from src/data/schema/index.ts without changing existing exports.

- [ ] Step 4: Create migrations/0010_phase_c_calendar_write_surface.sql with create table statements matching Drizzle exactly. The migration is additive and must not alter, drop, or recreate any Phase B table.

- [ ] Step 5: Run the schema GREEN checks.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\contract\data\calendar-write-schema.contract.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
~~~

Expected result: all schema assertions and source TypeScript checks pass.

- [ ] Step 6: Commit the schema.

~~~powershell
git add -- src/data/schema/calendar-write.ts src/data/schema/index.ts migrations/0010_phase_c_calendar_write_surface.sql tests/contract/data/calendar-write-schema.contract.test.ts
git commit -m "feat: add Phase C write persistence schema"
~~~

## Task 3: Define the encrypted approval and durable ledger RED tests

Files: Create tests/unit/data/calendar-write-repository.test.ts; create the not-yet-created repository module.

- [ ] Step 1: Add a fake database with recorded parameterized calls. It implements only execute, returns scripted rows, and records SQL parameters without printing proposal content. Add a deterministic in-memory KeyProvider whose getDataKey returns a Web Crypto AES-GCM key and key version 1.

- [ ] Step 2: Test encrypted approval creation and loading. Build a valid CalendarWriteProposal, call the wished-for createApproval, assert the inserted envelope bytes do not contain the title or description, script the same row for loadProposal, and assert the decrypted proposal equals the original immutable proposal.

- [ ] Step 3: Test approval compare-and-set and owner scope. Assert that confirming an unexpired proposed row returns confirmed, a second confirmation returns already_confirmed, an expired row returns expired, and a different owner returns missing without updating a row.

- [ ] Step 4: Test exactly-one durable ledger claim. Assert that the first claim(ownerId, operationId, calendarId) returns claimed, a conflict returns existing, and the second caller cannot change the stored owner or calendar scope.

- [ ] Step 5: Test ledger transitions and strict decoding. Cover markPending, markVerified, markFailed, and markUndone, including paired event ID/version validation and rejection of unknown status, empty identity, invalid timestamp, and cross-owner rows.

- [ ] Step 6: Run the repository RED check.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\unit\data\calendar-write-repository.test.ts
~~~

Expected result: failure because the repository module and exported ports do not exist. Correct test-harness errors until the missing-module failure is observed.

- [ ] Step 7: Commit the RED tests only.

~~~powershell
git add -- tests/unit/data/calendar-write-repository.test.ts
git commit -m "test: define Phase C approval and ledger repository contract"
~~~

## Task 4: Implement encrypted approvals and the executor ledger

Files: Create src/data/repositories/calendar-write-repository.ts.

- [ ] Step 1: Export the repository ports and records. Use these exact public shapes:

~~~ts
export interface CalendarWriteApprovalStore {
  createApproval(input: {
    readonly proposal: CalendarWriteProposal;
    readonly requestedAt: Date;
    readonly expiresAt: Date;
  }): Promise<void>;
  findApproval(ownerId: string, operationId: string): Promise<CalendarWriteApprovalRecord | undefined>;
  loadProposal(ownerId: string, operationId: string): Promise<CalendarWriteProposal | undefined>;
  confirmApproval(ownerId: string, operationId: string, now: Date): Promise<"confirmed" | "already_confirmed" | "expired" | "missing">;
  invalidateApproval(ownerId: string, operationId: string, now: Date): Promise<void>;
}

export interface CalendarWriteApprovalRecord {
  readonly ownerId: string;
  readonly operationId: string;
  readonly provider: "google";
  readonly calendarId: string;
  readonly proposalDomain: "school" | "work" | "personal";
  readonly status: "proposed" | "confirmed" | "invalidated";
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}
~~~

Implement CalendarWriteLedger from src/domain/calendar-write/create-execution.ts with its existing signatures: find, claim, markPending, markVerified, markFailed, and markUndone.

- [ ] Step 2: Implement envelope encoding and decoding. Serialize the proposal as bounded JSON, encrypt it with encryptProtectedFields under owner ID, operation ID, and the proposal domain, encode the resulting CipherEnvelope with the existing envelope serializer, and store only UTF-8 bytes. On load, use proposal_domain to select the exact key partition, decrypt, parse JSON, and pass the result through createCalendarWriteProposal before returning it.

- [ ] Step 3: Implement strict database decoders. Accept only finite intrinsic Date values or timezone-aware timestamp strings, bounded nonempty identities, controlled provider google, exact status unions, and paired provider event fields. Throw one constant repository error without including row values or SQL details.

- [ ] Step 4: Implement atomic approval mutations. Use parameterized SQL with owner and operation predicates. confirmApproval updates only proposed rows whose expires_at is after now, returns already_confirmed for the same owner's confirmed row, returns expired for an expired proposed row after invalidating it, and returns missing for an absent or foreign row.

- [ ] Step 5: Implement the durable ledger port. claim inserts a writing row with on conflict do nothing and returns claimed only when the inserted owner/operation matches. markPending updates only an existing writing or verified row to verification_pending and never creates a missing row; this preserves the executor's conservative result for uncertain create or undo calls. markVerified updates only a matching owner row in writing or verification_pending and requires both provider event fields. markFailed updates only writing. markUndone updates only a verified row while retaining the provider event identity/version for replay safety.

- [ ] Step 6: Run repository tests GREEN.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\unit\data\calendar-write-repository.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
~~~

Expected result: repository and both TypeScript boundaries pass.

- [ ] Step 7: Commit the repository.

~~~powershell
git add -- src/data/repositories/calendar-write-repository.ts tests/unit/data/calendar-write-repository.test.ts
git commit -m "feat: add encrypted Phase C write repository"
~~~

## Task 5: Define the authenticated route RED tests

Files: Create tests/worker/calendar-write.test.ts; create the not-yet-created route module.

- [ ] Step 1: Build the injected route harness. Reuse existing Worker-test constants and createApp patterns. Inject sessions, tokens, a connected-calendar resolver, a fake provider, fake approval store, fake CalendarWriteLedger, fake audit writer, and deterministic operation ID generation. The fake provider records target reads, creates, marker lookups, read-backs, and deletes.

- [ ] Step 2: Write the first route behavior test. Assert that an authenticated CSRF-protected preview returns a server-generated operation ID and exact preview, uses the server owner and connected calendar, calls readCalendarVersion once, stores one approval, and does not call createOneOffEvent.

~~~ts
it("previews a server-owned one-off write without mutating the provider", async () => {
  const harness = createHarness();
  const response = await harness.app.fetch(
    post("/api/calendar/writes/preview", validPreviewInput(), CSRF),
    {} as Env,
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    operationId: OPERATION_ID,
    preview: { before: null, after: { title: "Study session" } },
  });
  expect(harness.provider.readCalendarVersion).toHaveBeenCalledWith("vision-calendar");
  expect(harness.provider.createOneOffEvent).not.toHaveBeenCalled();
});
~~~

- [ ] Step 3: Add authentication and strict-input tests. Test missing/invalid session, missing/wrong CSRF, wrong content type, oversized body, unknown keys, unsupported attendees/recurrence/notifications, and malformed date ranges. Assert provider and store calls remain zero when admission fails.

- [ ] Step 4: Add server-authority tests. Send forged ownerId, googleSubject, calendarId, provider version, event ID, and access-token fields. Assert extra keys are rejected and the provider receives only the session-bound owner, connected calendar, and token.

- [ ] Step 5: Add confirmation and replay tests. Test exact confirmation phrase, missing/expired/foreign approval, stale target invalidation, verified create, double confirmation, and concurrent confirmation. Assert exactly one provider create and exactly one ledger claim.

- [ ] Step 6: Add uncertain/pending/status tests. Test uncertain provider create with zero marker matches returns HTTP 202, status GET returns verification_pending, a later exact marker/read-back becomes verified, and mismatched read-back never becomes verified.

- [ ] Step 7: Add undo tests. Test that unverified operations cannot undo, a verified operation deletes once with stored calendar/event/version, not-found becomes undone, uncertain deletion returns 202, and an undone replay performs no second delete. Add owner-isolation assertions for status and undo.

- [ ] Step 8: Run route RED.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\worker\calendar-write.test.ts
~~~

Expected result: failure because the route module and route dependency types do not exist. Correct only harness errors until that is the observed missing-module failure.

- [ ] Step 9: Commit the route RED tests only.

~~~powershell
git add -- tests/worker/calendar-write.test.ts
git commit -m "test: define authenticated Phase C write routes"
~~~

## Task 6: Implement the authenticated route composition

Files: Create src/server/api/calendar-write-routes.ts.

- [ ] Step 1: Export CalendarWriteRouteDependencies with now, createOperationId, session lookup, token lookup, owner/subject-bound connected-calendar lookup, provider factory, approval store, ledger, and audit writer. No route body accepts owner or calendar authority.

- [ ] Step 2: Implement authentication and request readers. Resolve vision_session before body parsing, use findSession(sessionId, now), set authenticatedSession, verify CSRF for preview/confirm/undo, enforce JSON content type, enforce a fixed byte limit, parse fatal UTF-8, and map parser failures to INVALID_CALENDAR_WRITE_REQUEST.

- [ ] Step 3: Implement preview. Validate strict one-off input, resolve the session-bound connection and current token, read the provider calendar version, call createCalendarWriteProposal with server owner and generated operation ID, persist a ten-minute approval, and serialize only operation ID, expiry, and immutable preview.

- [ ] Step 4: Implement status. Validate the opaque path operation ID, load only the authenticated owner's approval and ledger records, prefer execution status when an execution row exists, otherwise project approval status, and return undoAvailable only for verified ledger records with both provider fields.

- [ ] Step 5: Implement confirmation. Require { confirmation: "CONFIRM ONE-OFF EVENT" }, confirm or replay the approval, load the stored proposal, create the provider and execution dependencies, call executeConfirmedCalendarCreate, invalidate the approval on stale target, and map verified/pending/invalidated/failed results to the approved status codes.

- [ ] Step 6: Implement undo. Require { confirmation: "UNDO ONE-OFF EVENT" }, create the session-bound provider, call undoVerifiedCalendarCreate with only owner and operation ID, and map its result without accepting client event/calendar/version values.

- [ ] Step 7: Implement production dependency resolution. Build the existing database, wrapped key provider, CalendarRepository connection lookup, encrypted DrizzleCalendarWriteRepository, createAuditWriter, token repository, and createGoogleEventWriteClient. Keep the adapter fixed-origin and bounded.

- [ ] Step 8: Run route tests GREEN.

~~~powershell
.\node_modules\.bin\vitest.cmd run tests\worker\calendar-write.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
~~~

Expected result: all route safety and type checks pass.

- [ ] Step 9: Commit route composition.

~~~powershell
git add -- src/server/api/calendar-write-routes.ts tests/worker/calendar-write.test.ts
git commit -m "feat: compose authenticated Phase C write routes"
~~~

## Task 7: Register the Worker route and preserve the release boundary

Files: Modify src/worker.ts, tests/worker/calendar-write.test.ts, scripts/scan-release.ts, and tests/security/google-write-surface.test.ts.

- [ ] Step 1: Add the optional calendarWrite dependency resolver beside existing setup, AI, diagnostic, and webhook dependencies. Register calendar-write routes before the generic API fallback.

- [ ] Step 2: Assert that an injected route is reachable through createApp, that the calendar-write paths no longer return generic API NOT_FOUND, and that existing route behavior remains unchanged.

- [ ] Step 3: Update the source allowlist narrowly. Add only the route module and existing bounded event-write adapter operations. Do not allow arbitrary fetch, arbitrary URL construction, provider SDK expansion, or route bypasses.

- [ ] Step 4: Run Worker and security checks.

~~~powershell
.\node_modules\.bin\vitest.cmd run --project worker
.\node_modules\.bin\vitest.cmd run tests\security\google-write-surface.test.ts
.\node_modules\.bin\tsx.cmd scripts\scan-release.ts
~~~

Expected result: all Worker tests and the release surface scan pass.

- [ ] Step 5: Commit Worker registration.

~~~powershell
git add -- src/worker.ts scripts/scan-release.ts tests/security/google-write-surface.test.ts tests/worker/calendar-write.test.ts
git commit -m "feat: register bounded Phase C write surface"
~~~

## Task 8: Define the browser RED path

Files: Create tests/e2e/calendar-write.spec.ts; create the not-yet-created browser API and composer modules.

- [ ] Step 1: Add provider-free browser fixtures. Mock session, connected foundation/status, and the four calendar-write routes. Use one synthetic owner-safe preview with no provider identifiers exposed to the UI.

- [ ] Step 2: Write the first browser RED test. Navigate to the connected desk, assert the composer is visible, fill supported fields, click Preview event, and expect the exact preview heading and a disabled-until-preview Confirm one-off event control. The expected failure is that the composer is not rendered.

- [ ] Step 3: Add browser safety tests. Cover signed-out absence of write controls, exact preview rendering, confirmation request with one operation ID and CSRF, truthful HTTP 202 pending copy, reload recovery using only the opaque operation ID, verified undo, invalidated preview requiring a new preview, and narrow viewport layout.

- [ ] Step 4: Run browser RED.

~~~powershell
.\node_modules\.bin\tsx.cmd scripts\run-e2e.ts --grep "one-off event"
~~~

Expected result: failure because the browser composer and route client do not exist. Correct fixture/test syntax errors until the missing UI failure is observed.

- [ ] Step 5: Commit the browser RED tests only.

~~~powershell
git add -- tests/e2e/calendar-write.spec.ts
git commit -m "test: define Phase C browser write loop"
~~~

## Task 9: Implement the browser API and composer

Files: Create src/client/calendar/writes/api.ts and src/client/calendar/OneOffEventComposer.tsx; modify src/client/App.tsx and src/client/styles.css.

- [ ] Step 1: Implement the browser API parser. Export typed previewOneOffEvent, readOneOffWriteStatus, confirmOneOffEvent, and undoOneOffEvent. Send same-origin credentials, attach the session CSRF token to mutations, retain only operation ID in session storage, parse only the public response shape, and collapse malformed/non-OK responses to safe constant errors.

- [ ] Step 2: Implement form state. Collect only title, description, timestamps, timezone, domain, and privacy. Submit fixed attendees empty array, recurrence null, and notifications none. Never render or store owner, Google subject, calendar ID, provider event ID, provider version, or access token.

- [ ] Step 3: Implement preview and confirmation states. Render the exact server preview, disable confirmation until preview exists, send the exact confirmation body, and show Verifying calendar state while the request is in flight. A 202 response renders Verification pending and only a status-check action.

- [ ] Step 4: Implement verified undo and recovery. Show undo only for verified status, send the exact undo confirmation body, render Undone only after the server response, and on reload call status using the retained opaque operation ID. Invalidated, expired, and failed states clear the active operation and require a new preview.

- [ ] Step 5: Compose the component into the connected desk beside EventList; keep setup, signed-out, unavailable, and read-only event paths unchanged.

- [ ] Step 6: Add responsive styling using existing button, surface, focus, and status tokens. Keep a single-column narrow-viewport layout for form and preview without changing the setup signal rail.

- [ ] Step 7: Run browser tests GREEN.

~~~powershell
.\node_modules\.bin\tsx.cmd scripts\run-e2e.ts --grep "one-off event"
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
~~~

Expected result: all targeted browser and TypeScript checks pass.

- [ ] Step 8: Commit the browser surface.

~~~powershell
git add -- src/client/calendar/writes/api.ts src/client/calendar/OneOffEventComposer.tsx src/client/App.tsx src/client/styles.css tests/e2e/calendar-write.spec.ts
git commit -m "feat: add Phase C one-off event browser loop"
~~~

## Task 10: Add documentation and update the Phase C handoff

Files: Create the six reference files in the file map; modify related _folder.md guides, docs/operations/phase-c-handoff.md, and PROJECT_PLAN.md.

- [ ] Step 1: Document the repository. Explain approval encryption, proposal_domain key partition, owner-scoped compare-and-set, exactly-one ledger claim, paired provider identity/version, and safe decoder failures in simple and technical references.

- [ ] Step 2: Document the routes. Explain preview, status, confirmation, undo, CSRF, server-derived authority, HTTP 200/202/409/503 mapping, and truthful pending behavior without provider credentials or private test data.

- [ ] Step 3: Document the browser composer. Define preview as a proposed change, confirmation as deliberate approval, verification pending as unknown provider state, and undo as verified absence.

- [ ] Step 4: Update the handoff and project plan only after implementation tests pass. Record the authenticated local write surface and durable ledger as locally implemented and verified, state that live Google acceptance and deployment remain gated, preserve explicit Phase C non-goals, and record the hardline no more than 20 agents at once.

- [ ] Step 5: Run documentation coverage.

~~~powershell
.\node_modules\.bin\tsx.cmd scripts\validate-doc-coverage.ts
~~~

Expected result: exit 0 with every new production module covered.

- [ ] Step 6: Commit documentation.

~~~powershell
git add -- docs/reference docs/operations/phase-c-handoff.md PROJECT_PLAN.md
git commit -m "docs: record authenticated Phase C write surface"
~~~

## Task 11: Full local verification and acceptance boundary

Files: No new production files; update tests or docs only when a failing verification identifies a real contract mismatch.

- [ ] Step 1: Run focused schema, repository, Worker route, adapter contract, and browser commands from Tasks 1–9. Record counts and any known Wrangler linked-worktree log warning without treating it as a test failure.

- [ ] Step 2: Run the complete local suites.

~~~powershell
.\node_modules\.bin\vitest.cmd run --project unit
.\node_modules\.bin\vitest.cmd run --project contract
.\node_modules\.bin\vitest.cmd run --project worker
~~~

Expected result: zero failing tests and no changed Phase B behavior.

- [ ] Step 3: Run TypeScript and build checks.

~~~powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\tsx.cmd scripts\validate-production-crypto-boundary.ts
~~~

Expected result: all commands exit 0. The known Wrangler optional user-log EPERM warning may remain contained and must not be mistaken for an application failure.

- [ ] Step 4: Run release and diff checks.

~~~powershell
.\node_modules\.bin\tsx.cmd scripts\capture-release-evidence.ts
.\node_modules\.bin\tsx.cmd scripts\scan-release.ts
git diff --check
~~~

Expected result: fresh release evidence, a passing narrow release scan, and no whitespace errors.

- [ ] Step 5: Verify no external mutation occurred. Confirm the command log contains no live Google create/delete call, no deployment, no push, and no production database migration. This increment is locally verified only.

- [ ] Step 6: Complete any final test-only correction through a new RED/GREEN cycle and commit it with the narrowest relevant message. Do not fold unrelated cleanup into the final commit.

- [ ] Step 7: Verify the branch.

~~~powershell
git status --short
git branch --show-current
git rev-parse HEAD
~~~

Expected result: clean codex/phase-c-write-pipeline branch. Do not push or deploy without a separate explicit instruction.

## Completion boundary

This plan completes the local authenticated one-off create surface when the browser can preview, explicitly confirm, observe verified or pending state, recover status after reload, and undo only a verified create, with all local tests and release checks green. It does not complete live provider acceptance, event updates, recurring events, attendees, notifications, or later Phase C MVP increments.
