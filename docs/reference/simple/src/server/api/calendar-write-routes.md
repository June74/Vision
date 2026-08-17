# Calendar-write routes

These authenticated routes let the owner review one narrow event mutation,
including explicit whole-series scope, recurrence, attendees, and notification
intent; confirm it deliberately, check an uncertain result, and recover only
after provider verification. The server supplies owner, connected calendar,
provider token, event ID, and version.

## `registerCalendarWriteRoutes`

Mounts preview, status, confirm, and undo.

## `createProductionCalendarWriteDependencies`

Connects the existing auth, database, encryption, provider, and audit pieces.

## `now`

Supplies server time.

## `createOperationId`

Creates the opaque handle shown to the browser.

## `createCalendarRepository`

Creates an owner- and account-bound calendar reader.

## `createProvider`

Creates the bounded provider adapter after token checks.

## `authenticateRequest`

Finds the authenticated session before body parsing.

## `requireCsrf`

Protects preview, confirm, and undo.

## `resolveConnectedCalendar`

Requires an existing connected Vision calendar.

## `resolveProvider`

Requires a current access token.

## `resolveRouteDependencies`

Hides dependency initialization failures.

## `readBoundedJson`

Reads small JSON bodies with strict content and size checks.

## `readOperationId`

Checks a route operation handle.

## `readDate`

Copies a valid server Date.

## `isBoundedIdentity`

Checks opaque bounded text.

## `writeResponse`

Returns only operation status, safe preview, and undo availability.

## `toMutationEventInput`

Copies the server-read provider event into the strict mutation preview shape,
including recurrence, attendee count, and notification policy.

## `mergeMutationEventInput`

Applies only explicitly requested patch fields to the server-read event,
including a required explicit scope for recurring events.

## `requireMutationProvider`

Requires the reviewed update, move, and cancellation provider methods.

## `mutationConfirmationPhrase`

Returns the exact action-specific mutation confirmation phrase.

## `mutationWriteResponse`

Returns mutation status and the safe before/after preview without provider
details.

## `noStore`

Prevents caching of operation state.

## `invalidCalendarWriteRequest`

Returns the safe 400 error.

## `calendarWriteNotFound`

Returns the safe owner-scoped 404 error.

## `calendarWriteConflict`

Returns the safe 409 stale/invalid-state error.

## `calendarWriteUnavailable`

Returns the safe 503 persistence/provider error.

## `publicMutationPreview`

Redacts attendee addresses from a mutation response while retaining count,
recurrence, and notification intent.
