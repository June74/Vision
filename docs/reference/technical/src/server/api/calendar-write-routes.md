# Calendar-write routes

The module composes the existing authenticated session, CSRF, owner-scoped
calendar repository, token repository, Google event-write adapter, encrypted
approval store, execution ledger, and privacy-safe audit writer. It does not
perform live acceptance by itself.

## `registerCalendarWriteRoutes`

Registers exactly:

- `POST /api/calendar/writes/preview`
- `GET /api/calendar/writes/:operationId`
- `POST /api/calendar/writes/:operationId/confirm`
- `POST /api/calendar/writes/:operationId/undo`

All responses set `Cache-Control: no-store`. Authentication precedes body
parsing and provider-token resolution. The strict preview body admits only the
one-off fields and fixed no-attendee/no-recurrence/no-notification effects.

## `createProductionCalendarWriteDependencies`

Builds production dependencies with the existing auth factories, database,
wrapped key provider, `DrizzleCalendarWriteRepository`, bounded Google adapter,
and audit writer. Deployment and live provider calls remain a later gate.

## `now`

Returns a fresh server timestamp for approval expiry and executor transitions.

## `createOperationId`

Generates the only browser-visible operation authority; all provider and owner
identities remain derived server-side.

## `createCalendarRepository`

Captures the session owner and Google subject in the existing calendar store.

## `createProvider`

Binds the validated access token to `createGoogleEventWriteClient`; callers
cannot choose an alternate provider or transport.

## `authenticateRequest`

Resolves `vision_session`, validates it through the server session repository,
and installs the authenticated request variable before reading body content.

## `requireCsrf`

Uses the existing constant-time CSRF check and maps failure to
`CSRF_VALIDATION_FAILED`.

## `resolveConnectedCalendar`

Requires connected setup status plus bounded calendar ID and provider ETag from
the owner/subject-bound repository.

## `resolveProvider`

Loads tokens by authenticated Google subject, rejects missing/expired access,
and creates the provider only after those checks.

## `resolveRouteDependencies`

Resolves injected test or production dependencies and collapses initialization
failures into `CALENDAR_WRITE_UNAVAILABLE`.

## `readBoundedJson`

Requires JSON content type, a declared/streamed body at or below the fixed cap,
fatal UTF-8 decoding, and valid JSON. It cancels an oversized stream.

## `readOperationId`

Applies the operation-ID schema before repository access.

## `readDate`

Uses a fresh valid Date copy and never accepts a caller timestamp.

## `isBoundedIdentity`

Rejects empty, oversized, and control-bearing calendar/provider identities.

## `writeResponse`

Projects proposal preview and execution status while intentionally excluding
provider body, token, subject, calendar authority, and audit details.

## `toMutationEventInput`

Normalizes a provider read into the immutable mutation preview descriptor. It
sets the Phase C one-off policy explicitly: zero attendees, no recurrence, and
no notifications.

## `mergeMutationEventInput`

Merges the narrow browser patch into the authenticated provider read. This
prevents the browser from supplying hidden before-state, calendar, owner, or
version authority.

## `requireMutationProvider`

Checks the optional provider port before a mutation route can reach execution.
The route fails closed if any reviewed mutation method is absent.

## `mutationConfirmationPhrase`

Maps update, move, cancel, and delete to their fixed confirmation phrases.

## `mutationWriteResponse`

Projects verified, pending, failed, and invalidated mutation outcomes into the
safe response envelope while keeping provider identity and version server-side.

## `noStore`

Sets the no-store cache directive on success and error paths.

## `invalidCalendarWriteRequest`

Throws constant `INVALID_CALENDAR_WRITE_REQUEST` with HTTP 400.

## `calendarWriteNotFound`

Throws constant `CALENDAR_WRITE_NOT_FOUND` with HTTP 404; foreign-owner rows
are indistinguishable from absence.

## `calendarWriteConflict`

Throws constant `CALENDAR_WRITE_CONFLICT` with HTTP 409 for stale, expired,
invalidated, failed, or not-verified operations.

## `calendarWriteUnavailable`

Throws constant `CALENDAR_WRITE_UNAVAILABLE` with HTTP 503 for safe persistence
or provider availability failures.

The normal result mapping is 200 for verified/undone, 202 for
`verification_pending`, 409 for invalidated/failed/not-verified, and 503 for
availability failures. A pending result is never presented as provider success.
