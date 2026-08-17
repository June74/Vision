# Phase C remaining MVP increments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase C's remaining live-accepted calendar mutation and secretary MVP increments from the existing local one-off write surface.

**Architecture:** Extend the existing provider-neutral approval and durable-ledger boundary instead of creating parallel write routes. Connected-calendar actions remain server-authoritative, previewed, explicitly confirmed, freshness-checked, idempotent, read-back verified, audited, and recoverable. Vision-local tasks, notes, capture, scheduling, briefings, and follow-ups use separate typed domain and repository boundaries and never silently grant calendar-write permission.

**Tech Stack:** TypeScript, React, Vite, Hono, Drizzle ORM, Neon PostgreSQL, Zod, Web Crypto, Google Calendar API, Vitest, Workers test pool, Playwright, pnpm, Wrangler, GitHub Actions.

**Hardline:** **No more than 20 agents at once. This is a hard line.** Execute inline with 0 active agents; do not dispatch parallel implementation agents.

**Execution rule:** Work in `C:\Users\2006i\OneDrive\Documents\AI calendar (secretary) project\.worktrees\phase-c-write-pipeline` on branch `codex/phase-c-write-pipeline`. Do not work on `main`. Do not push, deploy, apply a production migration, or change production secrets. Preview mutations are limited to the explicitly authorized disposable private-pilot fixture and must be followed by cleanup proof.

---

### Task 1: Freeze the continuation boundary and live target record

**Files:**
- Modify: `docs/operations/phase-c-handoff.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `docs/operations/calendar-setup-evidence.md`
- Modify: `docs/operations/setbacks/INDEX.md` only when an existing incident recurs

- [ ] **Step 1: Record the authorization without private identifiers**

Record the approval date, the disposable-fixture requirement, the preview-only boundary, the no-production rule, and the hardline. Do not add the Google account, calendar ID, event title, token, database URL, or raw response.

- [ ] **Step 2: Record the live acceptance admission checks**

List the exact safe evidence required: preview health, authenticated reads, migration version, reviewed commit, one create, one read-back, replay count, one undo, absence, audit categories, and restored normal preview health.

- [ ] **Step 3: Run documentation coverage**

Run `pnpm.cmd docs:check` and fix only documentation coverage failures before continuing.

- [ ] **Step 4: Commit the boundary record**

Run `git add docs/operations/phase-c-handoff.md PROJECT_PLAN.md docs/operations/calendar-setup-evidence.md` followed by `git commit -m "docs: authorize Phase C private-pilot continuation"`.

### Task 2: Live preview readiness and one-off acceptance

**Files:**
- Read: `.github/workflows/preview.yml`
- Read: `docs/operations/environments.md`
- Read: `docs/operations/google-oauth-setup.md`
- Read: `migrations/0010_phase_c_calendar_write_surface.sql`
- Create: `docs/operations/phase-c-live-acceptance.md`
- Test: `tests/contract/phase-c-live-acceptance-record.contract.test.ts`

- [ ] **Step 1: Write the safe acceptance-record contract test**

Assert that the acceptance record allows only timestamp, reviewed commit, safe status/category fields, opaque operation digest, event-count facts, and cleanup status. Assert that it rejects account identifiers, calendar IDs, event content, tokens, database URLs, secrets, provider response bodies, and credential-bearing URLs.

- [ ] **Step 2: Run the contract test RED**

Run `pnpm.cmd exec vitest run tests/contract/phase-c-live-acceptance-record.contract.test.ts --config vitest.config.ts`. Confirm it fails because the acceptance record does not yet exist.

- [ ] **Step 3: Implement the redacted acceptance record**

Create `docs/operations/phase-c-live-acceptance.md` with the safe record schema and operational sequence. Keep all target identities as aliases or omitted values.

- [ ] **Step 4: Run the contract test GREEN**

Run the same Vitest command and require zero failures.

- [ ] **Step 5: Verify preview health and access without mutation**

Use the existing preview health endpoint and read-only Wrangler checks. Capture only HTTP status, safe body shape, and command exit status. If the preview database cannot be independently confirmed as disposable or migration `0010` cannot be applied through an approved operator path, record the live gate as pending and do not deploy a route that would fail on missing tables.

- [ ] **Step 6: If readiness is proven, run the one-off acceptance**

Deploy only the reviewed Phase C commit through the existing preview admission workflow, run preview → exact confirm → read-back → replay/status → verified undo → absence, and restore normal preview state. Record safe evidence only. Never run a production command.

- [ ] **Step 7: Commit acceptance evidence or a safe pending record**

Run `git diff --check`, `pnpm.cmd docs:check`, and `git commit -m "docs: record Phase C one-off acceptance boundary"` only after the record is internally valid and contains no private data.

### Task 3: Extend the provider-neutral mutation contract

**Files:**
- Modify: `src/domain/calendar-write/approval.ts`
- Create: `src/domain/calendar-write/event-mutation.ts`
- Test: `tests/unit/domain/calendar-write-mutation.test.ts`
- Test: `tests/unit/domain/calendar-write-approval.test.ts`

- [ ] **Step 1: Write failing mutation lifecycle tests**

Cover update, move, cancellation, and direct-delete proposals with immutable before/after previews; exact action types; required provider event identity; paired target/version facts; explicit cancellation versus deletion; rejected unknown fields; and invalid occurrence/series scope.

- [ ] **Step 2: Run the focused tests RED**

Run `pnpm.cmd exec vitest run tests/unit/domain/calendar-write-mutation.test.ts tests/unit/domain/calendar-write-approval.test.ts --config vitest.config.ts`. Confirm the new mutation contract fails for missing types and transitions.

- [ ] **Step 3: Implement the minimal immutable mutation value objects**

Add strict Zod-backed input parsing, deep-freezing, exact persisted-value restoration, action-specific preview shapes, and transitions for proposed, confirmed, writing, verification-pending, verified, failed, and undone states. Do not add provider calls in this task.

- [ ] **Step 4: Run focused tests GREEN**

Run the same command and require all mutation and existing approval tests to pass.

- [ ] **Step 5: Commit the provider-neutral contract**

Run `git add src/domain/calendar-write/approval.ts src/domain/calendar-write/event-mutation.ts tests/unit/domain/calendar-write-mutation.test.ts tests/unit/domain/calendar-write-approval.test.ts` and commit with `feat: add Phase C event mutation contract`.

### Task 4: Extend the durable approval and operation ledger

**Files:**
- Modify: `src/data/schema/calendar-write.ts`
- Create: `migrations/0011_phase_c_event_mutations.sql`
- Modify: `src/data/repositories/calendar-write-repository.ts`
- Test: `tests/contract/data/calendar-write-mutation-schema.contract.test.ts`
- Test: `tests/unit/data/calendar-write-repository.test.ts`

- [ ] **Step 1: Write schema and repository RED tests**

Assert that action, provider event identity, expected provider version, mutation scope, and encrypted before/after proposal content are persisted with owner and operation uniqueness. Assert additive-only migration behavior and strict decoder rejection of malformed rows.

- [ ] **Step 2: Run schema and repository tests RED**

Run `pnpm.cmd exec vitest run tests/contract/data/calendar-write-mutation-schema.contract.test.ts tests/unit/data/calendar-write-repository.test.ts --config vitest.config.ts` and confirm failure is caused by the missing mutation columns/repository methods.

- [ ] **Step 3: Implement the additive schema and owner-scoped repository methods**

Add only additive columns/tables, preserve `proposal_domain` key partitioning, use compare-and-set for confirmation/claim/terminal transitions, and retain paired provider event identity/version for replay safety. Keep provider content encrypted and error messages constant.

- [ ] **Step 4: Run schema and repository tests GREEN**

Run the same focused command plus the existing full calendar-write repository suite.

- [ ] **Step 5: Commit the mutation ledger**

Run `git diff --check` and commit with `feat: persist Phase C event mutations`.

### Task 5: Add provider mutation methods and deterministic executor paths

**Files:**
- Modify: `src/domain/calendar-write/create-execution.ts`
- Create: `src/domain/calendar-write/mutation-execution.ts`
- Modify: `src/integrations/google-calendar/event-write-client.ts`
- Test: `tests/unit/domain/calendar-write-mutation-execution.test.ts`
- Test: `tests/contract/integrations/google-event-write-client.contract.test.ts`
- Test: `tests/security/google-write-surface.test.ts`

- [x] **Step 1: Write failing executor and adapter tests**

Cover one update, one move, one cancellation, one direct delete, stale version invalidation, exact read-back, definite versus uncertain provider outcomes, no blind retry, exactly-one ledger claim, and owner/provider/event/version binding. Cover Google fixed-origin PATCH/DELETE URLs, `sendUpdates` policy, bounded request/response parsing, and constant provider failures.

- [x] **Step 2: Run the focused tests RED**

Run `pnpm.cmd exec vitest run tests/unit/domain/calendar-write-mutation-execution.test.ts tests/contract/integrations/google-event-write-client.contract.test.ts tests/security/google-write-surface.test.ts --config vitest.config.ts` and confirm missing mutation methods fail.

- [x] **Step 3: Implement minimal provider-neutral mutation execution**

Revalidate the stored target and event version immediately before the single provider mutation, reconcile uncertain outcomes through one read-back, require the approved fields to match, write safe audit facts, and expose only verified or pending results.

- [x] **Step 4: Implement the bounded Google adapter methods**

Add only the exact event PATCH/DELETE operations required by the executor. Reuse fixed-origin URL construction, token bounds, abort deadlines, status classification, and normalized event decoding. Do not add arbitrary fetch or provider SDK access.

- [x] **Step 5: Run focused tests GREEN and the release scan**

Run the focused command, `pnpm.cmd exec tsc --noEmit`, and `pnpm.cmd security:scan`. Update the exact release allowlist only for the reviewed route/adapter operations.

- [x] **Step 6: Commit the mutation executor and adapter**

Commit with `feat: add verified Phase C event mutations`.

### Task 6: Compose mutation routes, browser controls, and local acceptance

**Files:**
- Modify: `src/server/api/calendar-write-routes.ts`
- Modify: `src/client/calendar/writes/api.ts`
- Create: `src/client/calendar/EventMutationControls.tsx`
- Modify: `src/client/calendar/EventList.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/worker/calendar-write.test.ts`
- Test: `tests/e2e/calendar-mutations.spec.ts`

- [x] **Step 1: Write Worker and browser RED tests**

Assert authentication before body parsing, CSRF on every mutation, strict action-specific bodies, server-derived owner/calendar/event/version authority, exact confirmation phrases, 200/202/409/503 mapping, truthful pending state, reload recovery by opaque operation ID, verified undo/compensating result, and signed-out control absence.

- [x] **Step 2: Run Worker and browser RED checks**

Run the focused Worker test and `pnpm.cmd exec playwright test tests/e2e/calendar-mutations.spec.ts`. Confirm failures are caused by missing route and UI behavior.

- [x] **Step 3: Implement route composition and browser controls**

Add action-specific preview/status/confirm/recovery handling without accepting client authority fields or exposing provider IDs. Keep destructive controls disabled until a matching preview exists and show `Verification pending` whenever provider state is unknown.

- [x] **Step 4: Run Worker and browser GREEN checks**

Run the focused Worker and browser commands, then the complete Worker and browser suites.

- [x] **Step 5: Commit the user-facing mutation surface**

Run `git diff --check` and commit with `feat: compose Phase C mutation controls`.

- [ ] **Step 6: Run a fresh disposable preview acceptance for mutation parity**

Use one temporary event fixture per action, verify exact read-back and cleanup,
and record only safe counts/categories. Local action-specific route/browser
acceptance is green; the live fixture remains pending for the same independently
verified disposable database and deployment-admission gate.

### Task 7: Add recurrence, attendees, and notifications

**Files:**
- Modify: `src/domain/calendar-write/event-mutation.ts`
- Modify: `src/domain/calendar-write/mutation-execution.ts`
- Modify: `src/integrations/google-calendar/event-write-client.ts`
- Modify: `src/server/api/calendar-write-routes.ts`
- Create: `tests/unit/domain/calendar-write-recurrence.test.ts`
- Modify: `tests/contract/integrations/google-event-write-client.contract.test.ts`
- Modify: `tests/worker/calendar-write.test.ts`
- Create: `tests/e2e/calendar-recurrence.spec.ts`

- [x] **Step 1: Write recurrence/attendee/notification RED tests**

Cover one occurrence versus the whole series, recurrence rule bounds, stale series versions, attendee add/remove preview counts without leaking addresses, explicit notification policy, unsupported combinations, uncertain provider responses, and cleanup of a disposable series.

- [x] **Step 2: Run the focused tests RED**

Run the new unit/contract/Worker/browser tests and confirm the missing scope and policy behavior fails for the expected reason.

- [x] **Step 3: Implement the strict recurrence and notification contracts**

Normalize only supported Google fields, require explicit scope, retain attendee content encrypted, and never claim notification suppression without provider evidence.

- [ ] **Step 4: Run GREEN and fresh preview acceptance**

Run focused tests and full local checks, then one disposable occurrence/series
acceptance with exact cleanup and safe evidence. Local GREEN evidence is
complete; live acceptance remains pending until a disposable target database,
the required migration, and preview deployment admission are independently
verified. Do not substitute mocks or the health endpoint for this gate.

- [ ] **Step 5: Commit the recurrence surface**

Commit with `feat: add Phase C recurrence and attendee policy`.

### Task 8: Implement Vision-local capture, Today, tasks, and notes

**Files:**
- Create: `src/data/schema/secretary.ts`
- Create: `migrations/0012_phase_c_secretary_local.sql`
- Create: `src/domain/secretary/capture.ts`
- Create: `src/domain/secretary/today.ts`
- Create: `src/domain/secretary/task.ts`
- Create: `src/domain/secretary/note.ts`
- Create: `src/data/repositories/secretary-repository.ts`
- Create: `src/server/api/secretary-routes.ts`
- Create: `src/client/secretary/SecretaryDesk.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/unit/domain/secretary/*.test.ts`
- Test: `tests/unit/data/secretary-repository.test.ts`
- Test: `tests/worker/secretary.test.ts`
- Test: `tests/e2e/secretary.spec.ts`

- [x] **Step 1: Write domain, storage, Worker, and browser RED tests**

Cover owner isolation, exact date/timezone handling, protected note encryption, task completion and undo, capture ambiguity, Today ordering, no implicit calendar authority, and signed-out absence.

- [x] **Step 2: Run RED checks**

Run the focused unit, repository, Worker, and browser commands and confirm failures are due to missing local secretary behavior.

- [x] **Step 3: Implement the minimal typed local flows**

Use additive tables, encrypted protected content, deterministic Today projection, explicit task transitions, and capture records that can create a separate calendar proposal but cannot confirm one.

- [x] **Step 4: Run GREEN, full local checks, and documentation coverage**

Run `pnpm.cmd typecheck`, the complete unit/contract/Worker/browser suites, `pnpm.cmd docs:check`, `pnpm.cmd build`, and `pnpm.cmd security:scan`.

Local evidence is green: focused secretary unit/repository tests (12 passed), Worker tests (3 passed), full unit suite (1,868 passed, 6 skipped), full contract suite (199 passed), full Worker suite (141 passed), full browser suite (44 passed), typecheck, documentation coverage, build, security scan, and `git diff --check`. Migration `0012_phase_c_secretary_local.sql` is additive and not yet live-applied; live/private-pilot acceptance remains gated by an independently verified disposable database target and preview deployment admission.

- [x] **Step 5: Commit the local secretary flows**

Commit with `feat: add Vision local secretary flows`.

### Task 9: Implement scheduling proposals, briefings, and follow-ups

**Files:**
- Create: `src/domain/scheduling/proposal.ts`
- Create: `src/domain/briefings/briefing.ts`
- Create: `src/domain/follow-ups/follow-up.ts`
- Create: `src/server/api/planning-routes.ts`
- Create: `src/client/planning/PlanningDesk.tsx`
- Create: `tests/unit/domain/scheduling-proposal.test.ts`
- Create: `tests/unit/domain/briefing.test.ts`
- Create: `tests/unit/domain/follow-up.test.ts`
- Create: `tests/worker/planning.test.ts`
- Create: `tests/e2e/planning.spec.ts`

- [ ] **Step 1: Write deterministic planning RED tests**

Cover hard conflicts, timezone conversions, source-fact citations, unresolved ambiguity, feasible alternatives, briefing windows, follow-up lifecycle, AI-disabled behavior, and refusal to write without a calendar approval operation.

- [ ] **Step 2: Run RED checks**

Run the focused domain, Worker, and browser tests and confirm the expected missing behavior.

- [ ] **Step 3: Implement deterministic proposals and templates**

Build source-supported scheduling proposals and template-backed briefings/follow-ups. Keep AI optional and pass all content through existing privacy, budget, and policy boundaries.

- [ ] **Step 4: Run GREEN and full verification**

Run all focused tests plus `pnpm.cmd check` and `pnpm.cmd test:e2e`. Verify that no new mutating route bypasses the shared calendar-write pipeline.

- [ ] **Step 5: Commit planning surfaces**

Commit with `feat: add Phase C planning and follow-up flows`.

### Task 10: Final Phase C acceptance and handoff

**Files:**
- Modify: `docs/operations/phase-c-handoff.md`
- Modify: `PROJECT_PLAN.md`
- Create or modify: `docs/operations/phase-c-live-acceptance.md`
- Modify: mirrored `docs/reference/simple/**` and `docs/reference/technical/**` files for every new production file/function
- Test: all repository verification commands

- [ ] **Step 1: Run the complete local verification**

Run `pnpm.cmd check`, `pnpm.cmd test:e2e`, `pnpm.cmd typecheck`, `pnpm.cmd docs:check`, `pnpm.cmd build`, `pnpm.cmd security:scan`, and `git diff --check`. Capture fresh exit codes and counts.

- [ ] **Step 2: Verify the user-facing paths**

Exercise one confirmed and one pending/recovered calendar mutation, one recurrence/attendee/notification preview, Today/task/note flow, scheduling proposal, briefing, and follow-up in the actual local browser path. Do not rely only on imports or unit tests.

- [ ] **Step 3: Run or explicitly classify each live preview gate**

For every connected-write action, prove temporary fixture absence and privacy-safe evidence. If an external target or migration authority is unavailable, record the exact pending gate rather than claiming Phase C live completion.

- [ ] **Step 4: Update the handoff and project status**

Mark only evidence-backed increments complete, distinguish local and live status, preserve the Phase D boundary, and retain the exact hardline text.

- [ ] **Step 5: Commit the final handoff**

Commit documentation only after all required verification evidence is fresh and the worktree is clean.
