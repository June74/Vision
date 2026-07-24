# `src/integrations/google-calendar/event-sync-client.ts`

`EventSyncClient` is the provider-neutral, read-only page boundary used by the synchronization job.
`createGoogleEventSyncClient` implements it with Google Calendar API v3 `events.list`.

Every request fixes `showDeleted=true`, `singleEvents=false`, and a bounded `maxResults`. Incremental page requests keep
the original `syncToken`; only `pageToken` changes. A page is valid only when it has exactly one of `nextPageToken` or
terminal `nextSyncToken`. The collection `timeZone` is passed explicitly to `mapGoogleEvent`, so date-only values never
fall back to the Worker host timezone.

## `listChanges`

**Signature:** `(request: EventSyncListRequest) => Promise<EventSyncPage>`

Performs one GET, bounds the raw successful response to 8 MiB, validates the page through Zod, adds the trusted requested
calendar identity, and maps each item. The returned page contains closed changes and one continuation token.

## `createGoogleEventSyncClient`

**Signature:** `(options: GoogleEventSyncClientOptions) => EventSyncClient`

Snapshots a bounded bearer token, validates a page size from 1 through 2500, and returns an interface with no event
create, update, move, cancel, or delete method.

## `validateRequest`

Requires bounded non-empty calendar ID and optional opaque page/sync tokens. Errors contain constant text only.

## `addCalendarIdentity`

Requires an object item and overwrites any provider-supplied `calendarId` with the trusted requested collection ID.

## `classifyResponse`

Classifies 401 as authorization, 410 as `sync_token_invalid`, 429 and 5xx as transient, and uses only a bounded closed
403 reason projection for rate limit, quota, and permission policy. Unknown and malformed 403 responses stay permanent
provider failures.

## `readBoundedForbiddenReasons`

Reads no more than 8 KiB, performs fatal UTF-8 decoding, and validates at most sixteen bounded reason strings. It never
retains or reflects provider messages.

## `readBoundedJson`

Reads a successful response through the byte-capped stream helper, then performs fatal UTF-8 decoding and JSON parsing.
Oversized responses remain distinct from malformed schema.

## `readBoundedBytes`

Streams into bounded chunks, cancels the reader on overflow, and emits `payload_too_large` before a full provider page
can consume Worker memory.

## `classifyForbiddenReason`

Maps `rateLimitExceeded` and `userRateLimitExceeded` to transient retry, `quotaExceeded` to explicit non-retry quota
policy, known permission reasons to authorization, and every other value to provider failure.

## `validateSecretToken`

Rejects missing or oversized bearer credentials before an adapter is constructed.
