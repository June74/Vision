# Phase C Authenticated One-Off Write Surface Design

## Decision

The next Phase C increment will compose the verified one-off create executor
into the authenticated Vision application. It will provide one complete,
local-testable user loop:

`preview -> explicit confirmation -> verified create -> compensating undo`

The browser will never choose the owner, connected calendar, provider token,
provider event ID, or provider version. The server will derive ownership from
the existing `vision_session` session, resolve the connected Vision calendar
from the owner-scoped database connection, and use the existing CSRF contract
for every request that persists approval or changes provider state.

The exact proposal shown during preview will be retained in an encrypted
approval record. Confirmation will load that server-owned proposal rather than
trusting event content resent by the browser. The existing provider-neutral
executor will then use a separate durable execution ledger for its one-create,
uncertain-reconciliation, verified-read-back, and compensating-undo rules.

This increment adds the local HTTP and browser surface plus durable persistence
boundaries. It does not perform a live Google mutation or deploy a new
user-facing connected-write capability. Live acceptance remains a separate
explicit gate after the local route, browser, database-boundary, and release
checks are green.

## Agent-concurrency hardline

**No more than 20 agents at once is a hard line.** The implementation must
never create, dispatch, or run more than 20 agents concurrently. The current
implementation path uses zero agents and may continue inline; that is within
the hard limit.

## Current live path and integration boundary

The currently reachable browser path is:

`App -> authenticated session lookup -> connected-calendar setup -> FoundationDesk -> read-only EventList`

The currently registered Worker path is:

`createApp -> request context -> OAuth routes | calendar setup routes | AI category route | diagnostics | Google webhook -> API fallback`

There is no event-write route registered today. Existing authentication is the
opaque `vision_session` cookie resolved by a server-side session repository.
State-changing browser requests carry `x-vision-csrf`, which is checked against
the decrypted session CSRF value. Existing Phase B synchronization and
read-only event presentation remain unchanged.

The Phase C execution core already owns these provider-neutral rules:

- only a confirmed proposal can execute;
- the target calendar version is re-read immediately before mutation;
- one create is claimed per owner and operation ID;
- uncertain results are reconciled by the private operation marker;
- success requires exact provider read-back;
- audit facts contain only opaque IDs and controlled categories; and
- undo is a version-guarded compensating delete followed by absence read-back.

This increment must compose those rules, not duplicate or weaken them.

## Scope

### Included

1. An authenticated server route module for preview, status, confirmation, and
   undo of one-off event creates.
2. A strict request schema for one-off event content. The connected calendar
   and owner are server-derived.
3. An encrypted durable approval store for the exact immutable proposal and
   its target version.
4. A durable owner-scoped execution ledger implementing the existing
   `CalendarWriteLedger` port.
5. Atomic compare-and-set transitions for approval and ledger claims so
   concurrent browser requests cannot issue a second provider insert.
6. A small browser composer that shows the exact immutable preview, requires a
   deliberate confirmation action, reports `verification_pending` truthfully,
   and exposes undo only after verified creation.
7. Focused unit, database-boundary, Worker route, browser, security-surface,
   documentation, TypeScript, build, and release-scan coverage.

### Explicitly excluded

- event update, move, cancellation, or direct delete as a new user action;
- recurring events or occurrence-versus-series scope;
- attendees, invitations, or notification delivery;
- AI-generated permission, automatic confirmation, or model-authorized writes;
- accepting `ownerId`, `googleSubject`, `calendarId`, `eventId`, or provider
  version from the browser;
- a client-supplied proposal replay at confirmation time;
- storing event title, description, or other protected content in plaintext
  database columns or audit records;
- live Google account calls, production deployment, push, or release of a new
  connected-write capability in this implementation increment.

## User-facing contract

The connected desk gains a one-off event composer. It starts with editable
event fields and never displays provider credentials or raw provider response
data.

The supported input is deliberately narrow:

- title: required, bounded text;
- description: nullable, bounded text;
- start and end: timezone-aware ISO timestamps with end after start;
- time zone: bounded IANA-style text accepted by the existing proposal
  contract;
- domain: `school`, `work`, or `personal`;
- privacy: one existing Vision privacy level;
- attendees: always an empty list;
- recurrence: always `null`; and
- notifications: always `none`.

The connected Vision calendar is not a form field. The server reads the one
owner-scoped connection already established by Phase B setup and returns a
safe unavailable response if no valid connection exists.

## HTTP API

All four routes are mounted below `/api/calendar/writes`. Every route resolves
the session before processing caller-controlled body fields. Every response
sets `Cache-Control: no-store`.

### Preview

`POST /api/calendar/writes/preview`

This route is CSRF-protected because it persists an approval record even though
it does not mutate Google Calendar.

Request body:

```json
{
  "title": "Study session",
  "description": null,
  "startsAt": "2026-08-20T19:00:00-05:00",
  "endsAt": "2026-08-20T20:00:00-05:00",
  "timeZone": "America/Chicago",
  "domain": "school",
  "privacy": "private",
  "attendees": [],
  "recurrence": null,
  "notifications": "none"
}
```

The route will:

1. authenticate the `vision_session` cookie;
2. verify `x-vision-csrf`;
3. parse a strict bounded JSON body with no extra keys;
4. resolve the authenticated owner's connected Vision calendar;
5. resolve a current access token through the existing token repository;
6. read the selected calendar's current provider version;
7. build the existing immutable `CalendarWriteProposal` using the server
   owner, server time, generated opaque operation ID, and provider snapshot;
8. persist the proposal in the encrypted approval store with a fixed ten-
   minute approval expiry; and
9. return the operation ID, expiry, exact before/after preview, and explicit
   attendee, recurrence, and notification effects.

The response contains no access token, Google subject, provider body, or
provider request URL. The operation ID is the only opaque handle the browser
retains.

### Status

`GET /api/calendar/writes/:operationId`

This route is authenticated but does not require CSRF because it is read-only.
It returns only an owner-scoped operation. A different owner's operation is
indistinguishable from an absent operation.

The response shape is:

```json
{
  "operationId": "opaque-operation-id",
  "status": "proposed",
  "expiresAt": "2026-08-20T19:10:00.000Z",
  "preview": {
    "before": null,
    "after": {
      "title": "Study session",
      "description": null,
      "startsAt": "2026-08-20T19:00:00-05:00",
      "endsAt": "2026-08-20T20:00:00-05:00",
      "timeZone": "America/Chicago",
      "domain": "school",
      "privacy": "private",
      "attendees": { "mode": "none", "count": 0, "addresses": [] },
      "recurrence": { "scope": "one-off", "rules": [] },
      "notifications": { "policy": "none", "willNotify": false }
    }
  },
  "undoAvailable": false
}
```

The response may report `proposed`, `confirmed`, `writing`,
`verification_pending`, `verified`, `failed`, `undone`, or `invalidated`.
`undoAvailable` is true only for a durable `verified` execution with retained
event identity and version.

When both records exist, the status projection uses the execution ledger as
authoritative for `writing`, `verification_pending`, `verified`, `failed`, or
`undone`; otherwise it uses the owner-scoped approval record. An unexpired
approval with no execution row is `proposed` or `confirmed`. An expired
unexecuted approval is reported as `invalidated` and cannot be confirmed.

### Confirmation

`POST /api/calendar/writes/:operationId/confirm`

This route is CSRF-protected and accepts only the exact body:

```json
{ "confirmation": "CONFIRM ONE-OFF EVENT" }
```

The route will:

1. authenticate and verify CSRF;
2. load the encrypted approval by the session owner's ID and operation ID;
3. reject absent, expired, invalidated, or malformed approvals with a stable
   safe conflict/not-found response;
4. atomically transition `proposed` to `confirmed`, while allowing a replay
   of the same owner's already-confirmed approval to continue reconciliation;
5. decrypt and validate the stored proposal; and
6. call `executeConfirmedCalendarCreate` with the durable ledger, bounded
   provider adapter, and existing safe audit writer.

The route never reads event content, calendar identity, or provider version
from the confirmation body. A second confirmation can observe the existing
execution and reconcile it, but cannot claim a second provider insert.

Result mapping:

- `verified`: HTTP 200 with `undoAvailable: true`;
- `verification_pending`: HTTP 202 with truthful pending status;
- `invalidated`: HTTP 409 and a requirement to create a fresh preview;
- `failed`: HTTP 409 with constant safe failure copy; and
- a safe persistence/provider availability failure: HTTP 503.

### Undo

`POST /api/calendar/writes/:operationId/undo`

This route is CSRF-protected and accepts only the exact body:

```json
{ "confirmation": "UNDO ONE-OFF EVENT" }
```

The route passes only the owner ID and operation ID into
`undoVerifiedCalendarCreate`. It does not accept an event ID, calendar ID, or
version from the browser. The executor reads those values from the owner-
scoped durable ledger.

Result mapping:

- `undone`: HTTP 200 only after provider absence is verified;
- `verification_pending`: HTTP 202 when delete or absence is uncertain;
- `failed`: HTTP 409 when the operation was not verified or cannot be undone;
- replay of an already-undone operation: the same HTTP 200 `undone` result.

## Persistence design

The existing generic `operation_ledger` remains the Phase B setup/operation
surface. Phase C uses two dedicated tables so approval payloads and provider
execution state cannot be confused with calendar-setup statuses or generic
response envelopes.

### `calendar_write_approvals`

This table stores the server-owned approval envelope and its lifecycle:

- `operation_id` primary key;
- `owner_id` non-empty opaque owner identity;
- `provider` controlled provider code;
- `calendar_id` bounded provider calendar identity;
- `proposal_domain` controlled concrete domain used only to select the
  per-owner/per-domain encryption key;
- `status` constrained to `proposed`, `confirmed`, or `invalidated`;
- `requested_at` timezone-aware timestamp;
- `expires_at` timezone-aware timestamp;
- `proposal_envelope` non-null `bytea` ciphertext;
- a check that `expires_at` is after `requested_at`; and
- an owner/operation uniqueness constraint used by repository queries.

The proposal envelope is encrypted through the existing wrapped-key and
protected-fields boundary. Its authenticated context uses the owner ID,
operation ID, and the controlled `proposal_domain` key partition. The domain
column contains no event content; the plaintext proposal is never sent to SQL
as a normal text column.

The approval repository exposes only these operations:

- create one `proposed` row after strict proposal validation;
- find one row by fixed owner and operation scope;
- atomically confirm an unexpired `proposed` row;
- atomically invalidate a stale or expired row; and
- decrypt and validate the proposal only after the owner scope is established.

### `calendar_write_operations`

This table implements the executor's durable ledger contract:

- `operation_id` primary key;
- `owner_id` non-empty opaque owner identity;
- `provider` controlled provider code;
- `calendar_id` bounded provider calendar identity;
- `status` constrained to `writing`, `verification_pending`, `verified`,
  `failed`, or `undone`;
- `provider_event_id` nullable until verified;
- `provider_event_version` nullable until verified;
- `requested_at` timezone-aware timestamp;
- `completed_at` nullable timezone-aware timestamp;
- checks requiring event identity and version to be present together; and
- an owner/operation/provider uniqueness constraint.

The operation ledger repository implements the existing
`CalendarWriteLedger` port. `claim` uses an atomic insert or equivalent
compare-and-set operation and returns `claimed` only to the caller that owns
the new `writing` row. All reads and transitions include the owner ID in the
predicate. A database conflict, missing row, or invalid transition is a safe
persistence failure and never a provider success.

The migration is additive and must not rewrite or drop Phase B tables. The
schema contract and backup/schema-boundary tests must include both new tables,
their checks, and their ownership constraints.

## State and transaction rules

Approval and execution are separate lifecycles:

```text
approval: proposed -> confirmed -> invalidated
execution: absent -> writing -> verified -> undone
                         |             |
                         v             v
                 verification_pending  verification_pending
                         |
                         v
                       failed
```

The route/repository rules are:

1. Preview creates exactly one approval row for a newly generated operation
   ID. A provider read failure creates no approval row.
2. Confirmation uses a conditional update on owner, operation ID, status, and
   expiry. A concurrent loser reloads the authoritative row and may continue
   the same operation; it never receives authority to insert independently.
3. A crash after approval confirmation but before ledger claim is recoverable:
   a later confirmation reloads the confirmed proposal and claims the missing
   execution row.
4. A stale provider calendar version invalidates the approval and exits before
   the provider create call.
5. The executor's `claim` is the only transition that authorizes a create
   call. No HTTP retry, browser reload, or uncertain provider response may
   bypass it.
6. A verified execution stores only provider event identity and version in
   the ledger. Event content remains in the provider and the encrypted
   proposal envelope.
7. Undo is allowed only from `verified`. It uses the stored expected version
   and cannot be upgraded from uncertain or failed state.

## Security and privacy rules

- Authentication precedes request-body parsing and provider-token lookup.
- CSRF is required for preview, confirmation, and undo.
- The owner ID and Google subject come only from the resolved session.
- The connected calendar comes only from the owner-scoped connection record.
- Every provider adapter is created only after the session and access token
  checks succeed.
- Route schemas reject unknown keys, oversized bodies, invalid operation IDs,
  unsupported attendees, recurrence, and notifications.
- Operation IDs, provider event IDs, calendar IDs, and versions are treated as
  opaque bounded identities; they are never interpolated into audit messages.
- Provider errors collapse to constant safe categories. Response bodies, raw
  URLs, tokens, event descriptions, and attendee data never cross the error or
  audit boundary.
- Browser storage may retain only an opaque operation ID and status hint. It
  must not retain proposal content, tokens, or provider metadata.
- `GET` status and every mutation enforce owner scope in the persistence query,
  not by trusting a browser field.

## Browser behavior

The connected desk adds a focused `OneOffEventComposer` beside the existing
read-only event list.

1. The initial form collects only the supported one-off fields.
2. Preview submits through the CSRF-protected client API and displays the
   returned immutable before/after preview.
3. The confirmation control is disabled until the preview is present and the
   user deliberately activates `Confirm one-off event`.
4. While the request is executing, the UI says that Vision is verifying the
   calendar state; it never says the event was created before the server
   returns `verified`.
5. HTTP 202 renders `Verification pending` and offers `Check status`; it does
   not offer a second create action.
6. Only `verified` renders `Undo this event`.
7. Undo renders `Undone` only after the server confirms provider absence.
8. Invalidated, failed, or expired approvals require a new preview; the UI
   does not silently alter and resubmit an old proposal.
9. Reload recovery retains at most the opaque operation ID and uses the status
   route to recover the authoritative state.
10. Signed-out and unavailable session states render no event-write controls.

## Error and audit contract

The route layer maps internal failures to the existing `VisionError` envelope
with constant messages. The public categories are:

- `AUTHENTICATION_REQUIRED`;
- `CSRF_VALIDATION_FAILED`;
- `INVALID_CALENDAR_WRITE_REQUEST`;
- `CALENDAR_WRITE_NOT_FOUND`;
- `CALENDAR_WRITE_APPROVAL_EXPIRED`;
- `CALENDAR_WRITE_STALE_TARGET`;
- `CALENDAR_WRITE_NOT_VERIFIED`; and
- `CALENDAR_WRITE_UNAVAILABLE`.

Execution audit remains the existing closed `SafeAuditEvent` contract:

- `calendar.event.create` for create outcomes;
- `calendar.event.undo` for compensating undo outcomes;
- actor type `user`;
- provider code `google_calendar`; and
- only controlled error categories such as `calendar_target_stale`,
  `provider_failure`, `provider_uncertain`, `verification_mismatch`,
  `undo_uncertain`, and `undo_not_verified`.

The preview route may record a controlled `calendar.event.preview` audit fact
if the existing audit policy requires it, but the event body and proposal
content must never be included.

## Proposed repository changes

The implementation plan will confirm exact line-level edits, but the design
boundary is:

- Create `src/data/schema/calendar-write.ts` for the two dedicated tables and
  export it from `src/data/schema/index.ts`.
- Create an additive migration under `migrations/` for the two tables.
- Create a focused approval/ledger repository under
  `src/data/repositories/` using the existing Drizzle, Neon, protected-fields,
  and wrapped-key patterns.
- Create `src/server/api/calendar-write-routes.ts` with injected production
  and test dependencies, route schemas, authentication/CSRF composition, and
  safe response mapping.
- Register the route module in `src/worker.ts` without changing the existing
  route fallback behavior.
- Create the browser write API and `OneOffEventComposer`, then compose it into
  the connected desk without weakening the read-only event list.
- Update simple and technical reference documentation for every new
  production file and named public function, following the repository's
  existing documentation coverage contract.
- Update release/security allowlists so only the bounded Phase C adapter and
  route surface are reachable; no broad provider client must be exposed.

## Verification and acceptance gates

Implementation must use test-first development. For each new behavior, write
one focused failing test, run it to confirm the expected failure, implement the
minimum behavior, rerun it green, then refactor without changing behavior.

Required local evidence:

1. approval and repository unit tests;
2. schema manifest and migration contract tests;
3. route tests for authentication, CSRF, strict input, owner isolation,
   preview persistence, stale approval, double confirmation, uncertain create,
   verified read-back, and undo;
4. browser tests for preview, explicit confirmation, truthful pending state,
   reload status recovery, verified undo, signed-out controls, and narrow
   viewport behavior;
5. full unit, contract, Worker, and e2e suites;
6. source and test TypeScript checks;
7. documentation coverage, production build, crypto-boundary, release
   evidence, security-scan, and `git diff --check` checks; and
8. a clean branch with the spec, implementation, and evidence committed
   intentionally.

Live acceptance is a later gate and must use an explicitly approved disposable
or private-pilot fixture with a cleanup proof. It must prove one preview, one
confirmed create, exact read-back, one undo, verified absence, no duplicate
event after replay, and no leakage in logs or audit. No live provider call or
deployment is authorized by this design document alone.

## Design review checklist

- The HTTP layer is the only new user-facing entry point.
- The browser cannot supply authority-bearing identities or versions.
- Approval payloads are encrypted at rest and never audited as content.
- Execution and approval lifecycles are separated so the executor's existing
  ledger semantics remain correct.
- Unknown provider outcomes remain pending and cannot trigger a second create.
- Undo is explicit, owner-scoped, version-guarded, and verified by absence.
- Phase B read-sync and read-only presentation remain unchanged.
- The Phase C non-goals are explicit and testable.
- The hardline remains: no more than 20 agents at once.
