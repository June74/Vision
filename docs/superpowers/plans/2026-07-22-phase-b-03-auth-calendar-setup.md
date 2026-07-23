# Vision Phase B Authentication and Calendar Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow only June74's configured Google identity to establish a Vision session and explicitly create or connect one secondary calendar named `Vision`.

**Architecture:** The Worker owns OAuth state, authorization-code exchange, identity verification, encrypted token persistence, and server-side sessions. A deterministic setup state machine separates sign-in, account allowlisting, calendar discovery, exact confirmation, creation/connection, and initial-sync readiness.

**Tech Stack:** Hono, Google OAuth 2.0/OpenID Connect, Google Calendar API, Zod, encrypted PostgreSQL token store, React, Vitest, Playwright.

## Global Constraints

- Google sign-in is the only Version 1 identity method.
- Match the verified Google subject and email against server-side production allowlist values.
- Never use client-reported email or UI state as authorization evidence.
- Store refresh and access tokens encrypted; never expose them to the browser or logs.
- Create the `Vision` secondary calendar only after exact, current confirmation.
- Never modify or create events on the primary calendar.
- Re-running setup must not create a duplicate Vision calendar.
- Live integration tests use a disposable test account/calendar, never production.
- For every production file and named function, maintain concise `docs/reference/simple/` and in-depth `docs/reference/technical/` entries at mirrored paths; document meaningful folders with `_folder.md` in both trees.
- Require module/function JSDoc, use inline comments for non-obvious authentication and setup constraints, and run `pnpm docs:check` before every task commit.

---

### Task 1: Define authentication and setup state machines

**Files:**
- Create: `src/domain/auth/identity.ts`
- Create: `src/domain/setup/calendar-setup.ts`
- Test: `tests/unit/domain/identity.test.ts`
- Test: `tests/unit/domain/calendar-setup.test.ts`

**Interfaces:**
- Produces: `authorizeIdentity(claims, allowlist): AuthorizedIdentity`.
- Produces: `CalendarSetupState` and `transitionCalendarSetup(state, command)`.
- Produces: exact confirmation phrase `CREATE VISION CALENDAR`.

- [ ] **Step 1: Write denial and confirmation tests**

```ts
expect(() => authorizeIdentity({
  sub: "google-sub-2", email: "other@example.com", emailVerified: true,
}, { sub: "google-sub-1", email: "june@example.com" })).toThrow("ACCOUNT_NOT_ALLOWED");

expect(() => transitionCalendarSetup(discoveredState, {
  type: "confirm-create", phrase: "create vision calendar",
})).toThrow("EXACT_CONFIRMATION_REQUIRED");
```

Add tests for unverified email, wrong issuer/audience, expired claims, duplicate confirmation, existing-calendar connection, and stale setup version.

Run: `pnpm exec vitest run tests/unit/domain/identity.test.ts tests/unit/domain/calendar-setup.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 2: Implement pure authorization and setup transitions**

Require verified issuer, audience, expiration, subject, verified email, allowlisted subject, and normalized allowlisted email. Define setup states `signed_out`, `authenticated`, `discovering`, `awaiting_choice`, `awaiting_confirmation`, `creating`, `connected`, and `failed`. Every mutation includes the current setup version.

- [ ] **Step 3: Verify all state transitions**

Run: `pnpm exec vitest run tests/unit/domain/identity.test.ts tests/unit/domain/calendar-setup.test.ts`

Expected: all state-table tests pass.

- [ ] **Step 4: Commit the auth/setup contracts**

```powershell
git add src/domain/auth src/domain/setup tests/unit/domain
git commit -m "feat: define private-pilot setup policy"
```

### Task 2: Implement server-side Google OAuth and sessions

**Files:**
- Create: `src/integrations/google/oauth-client.ts`
- Create: `src/server/auth/oauth-routes.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/csrf.ts`
- Create: `src/data/repositories/token-repository.ts`
- Create: `src/data/repositories/session-repository.ts`
- Modify: `src/server/env.ts`
- Modify: `src/worker.ts`
- Test: `tests/contract/google/oauth.contract.test.ts`
- Test: `tests/worker/auth.test.ts`

**Interfaces:**
- Produces: `GoogleOAuthClient.createAuthorizationUrl` and `exchangeCode`.
- Produces: `requireSession(c): AuthenticatedSession`.
- Produces: `/api/auth/google/start`, `/api/auth/google/callback`, `/api/auth/session`, and `/api/auth/logout`.

- [ ] **Step 1: Write OAuth contract and session tests**

Assert authorization requests use state, PKCE, exact redirect URI, OpenID scopes, Calendar scope, offline access, and consent behavior appropriate for obtaining a refresh token. Assert callback rejects mismatched state, verifier, issuer, audience, nonce, subject, email, and expiry. Assert session cookies are `HttpOnly`, `Secure` outside local, `SameSite=Lax`, narrowly scoped, rotated after callback, and invalidated on logout.

Run: `pnpm exec vitest run tests/contract/google/oauth.contract.test.ts tests/worker/auth.test.ts`

Expected: FAIL because routes and adapter are absent.

- [ ] **Step 2: Implement the provider adapter and encrypted token store**

Use a narrow `fetch`-injected Google adapter. Encrypt the refresh token and any retained access token through `protected-fields.ts`. Store expiry, granted scopes, Google subject, and token version as queryable non-secret metadata. Keep OAuth state, PKCE verifier, and nonce in a short-lived server record, not a readable browser value.

- [ ] **Step 3: Add authenticated middleware**

On callback, validate identity through the domain allowlist before creating a session. Return a generic access-denied page for other accounts and write only a safe audit reason. Require CSRF tokens for session-authenticated state-changing API requests.

- [ ] **Step 4: Verify OAuth and session security**

Run: `pnpm exec vitest run tests/contract/google/oauth.contract.test.ts tests/worker/auth.test.ts && pnpm check`

Expected: all auth tests pass and protected token fixtures do not appear in logs or raw token rows.

- [ ] **Step 5: Commit authentication**

```powershell
git add src/integrations/google src/server/auth src/data/repositories src/server/env.ts src/worker.ts tests/contract/google tests/worker/auth.test.ts
git commit -m "feat: add allowlisted Google authentication"
```

### Task 3: Add calendar discovery and idempotent setup APIs

**Files:**
- Create: `src/integrations/google-calendar/calendar-client.ts`
- Create: `src/server/api/calendar-setup-routes.ts`
- Create: `src/data/repositories/calendar-repository.ts`
- Modify: `src/worker.ts`
- Test: `tests/contract/google/calendar-setup.contract.test.ts`
- Test: `tests/worker/calendar-setup.test.ts`

**Interfaces:**
- Produces: `CalendarClient.listOwnedSecondaryCalendars`, `createSecondaryCalendar`, and `getCalendar`.
- Produces: read-only `GET /api/setup/calendar`.
- Produces: CSRF-protected `POST /api/setup/calendar/discover`.
- Produces: CSRF-protected `POST /api/setup/calendar/select` and `POST /api/setup/calendar/confirm-create`.

The UI consumer first reads the snapshot, then submits its exact `setupVersion` to discovery. It preserves each returned version for selection or exact confirmation. Discovery lists the provider before one atomic final-state compare-and-swap; the server never persists an intermediate unleased `discovering` state.

- [ ] **Step 1: Write creation-safety tests**

Test no matching calendar, one matching owned calendar, multiple name matches, a non-owned shared calendar named Vision, repeated requests with the same idempotency key, stale setup version, provider timeout, and lost creation response. Assert no route calls an event insert/update/delete endpoint.

Run: `pnpm exec vitest run tests/contract/google/calendar-setup.contract.test.ts tests/worker/calendar-setup.test.ts`

Expected: FAIL because calendar setup adapters and routes are absent.

- [ ] **Step 2: Implement discovery and exact confirmation**

List calendars and classify owned secondary candidates by stable Google calendar ID, not name alone. Existing candidates require explicit selection. New creation requires body:

```ts
z.object({
  setupVersion: z.number().int().positive(),
  confirmation: z.literal("CREATE VISION CALENDAR"),
  idempotencyKey: z.string().uuid(),
})
```

Create only `{ summary: "Vision", timeZone: userTimeZone }`. Persist the returned ID, ownership, timezone, provider ETag, and verification timestamp.

- [ ] **Step 3: Reconcile uncertain creation outcomes**

If the create response is lost, discover calendars again and reconcile by operation ledger timestamp plus exact returned ownership evidence. If more than one plausible calendar remains, stop in `failed`/`Action required`; never guess and never create another.

- [ ] **Step 4: Verify adapter and Worker contracts**

Run: `pnpm exec vitest run tests/contract/google/calendar-setup.contract.test.ts tests/worker/calendar-setup.test.ts`

Expected: all cases pass, including duplicate suppression and zero event-write calls.

- [ ] **Step 5: Commit calendar setup API**

```powershell
git add src/integrations/google-calendar src/server/api src/data/repositories src/worker.ts tests/contract/google tests/worker
git commit -m "feat: add confirmed Vision calendar setup"
```

### Task 4: Build the authenticated setup interface

**Files:**
- Create: `src/client/auth/SignIn.tsx`
- Create: `src/client/setup/CalendarSetup.tsx`
- Create: `src/client/setup/api.ts`
- Create: `src/client/status/StatusBanner.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/e2e/auth-setup.spec.ts`

**Interfaces:**
- Consumes: session and calendar-setup routes from Tasks 2 and 3.
- Produces: visible signed-out, access-denied, discovery, choice, exact-confirmation, creating, connected, and action-required states.

- [ ] **Step 1: Write browser flows before UI code**

Create Playwright tests with mocked provider routes for:

1. Signed-out view shows `Sign in with Google`.
2. Wrong account shows access denied and no setup controls.
3. Existing owned Vision calendar can be selected and verified.
4. Create remains disabled until `CREATE VISION CALENDAR` is typed exactly.
5. Double click/reload creates only one request with one idempotency key.
6. Failure shows a safe retry/action-required state without raw provider errors.

Run: `pnpm test:e2e -- auth-setup.spec.ts`

Expected: FAIL because components do not exist.

- [ ] **Step 2: Implement accessible setup states**

Use real buttons, labels, status regions, keyboard focus, disabled and pending states, and explicit copy that setup creates a secondary calendar but no events. Do not display or store tokens. Preserve the server setup version and idempotency key across a retry of the same operation.

- [ ] **Step 3: Verify actual browser behavior**

Run: `pnpm test:e2e -- auth-setup.spec.ts && pnpm check`

Expected: all six flows pass in Chromium.

- [ ] **Step 4: Commit setup UI**

```powershell
git add src/client tests/e2e/auth-setup.spec.ts
git commit -m "feat: add safe calendar setup interface"
```

### Task 5: Run preview OAuth and disposable-calendar acceptance

**Files:**
- Create: `docs/operations/google-oauth-setup.md`
- Create: `docs/operations/calendar-setup-evidence.md`
- Modify: `.github/workflows/preview.yml`

**Interfaces:**
- Produces: repeatable preview OAuth configuration and acceptance evidence.

- [ ] **Step 1: Document exact external setup**

Record the Google Cloud project, consent-screen mode, exact preview redirect URI, approved scopes, test-account policy, allowlist secret names, token revocation steps, and disposable-calendar cleanup. Do not record secret values.

- [ ] **Step 2: Obtain approval before external changes**

Ask the user before creating/configuring the Google Cloud OAuth client, preview Worker, Neon branch, or secrets. Stop if approval is not granted.

- [ ] **Step 3: Exercise the real acceptance flow**

With the approved disposable Google account: attempt a wrong-account login, complete allowed login, type the exact confirmation, create the disposable Vision calendar, reload, and verify no duplicate. Inspect the calendar in Google and confirm it is secondary and contains zero events.

- [ ] **Step 4: Record and commit non-secret evidence**

Document timestamps, test account alias, opaque calendar ID suffix, HTTP outcomes, and cleanup result. Exclude tokens, claims, full IDs, and private content.

```powershell
git add docs/operations .github/workflows/preview.yml
git commit -m "docs: record Google setup acceptance"
```

## Milestone verification

Run the unit, Worker, Google contract, and setup browser suites. Then repeat the approved preview flow using a disposable calendar. The milestone passes only when the wrong account cannot establish a session, exact confirmation is enforced, one secondary calendar is connected, no event is created, raw token storage contains no plaintext sentinel, and logout/revocation stops access.
