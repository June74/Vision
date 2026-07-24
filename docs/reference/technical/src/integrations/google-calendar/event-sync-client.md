# `src/integrations/google-calendar/event-sync-client.ts`

`EventSyncClient` is the provider-neutral, read-only page boundary used by the synchronization job.
`createGoogleEventSyncClient` implements it with Google Calendar API v3 `events.list`.

Every request fixes `showDeleted=true`, `singleEvents=false`, and a bounded `maxResults`. Incremental page requests keep
the original `syncToken`; only `pageToken` changes. A page is valid only when it has exactly one of `nextPageToken` or
terminal `nextSyncToken`. The collection `timeZone` is passed explicitly to `mapGoogleEvent`, so date-only values never
fall back to the Worker host timezone.

## `listChanges`

**Signature:** `(request: EventSyncListRequest) => Promise<EventSyncPage>`

Performs one GET, never reads or returns the provider error body, validates the page through Zod, adds the trusted
requested calendar identity, and maps each item. The returned page contains closed changes and one continuation token.

## `createGoogleEventSyncClient`

**Signature:** `(options: GoogleEventSyncClientOptions) => EventSyncClient`

Snapshots a bounded bearer token, validates a page size from 1 through 2500, and returns an interface with no event
create, update, move, cancel, or delete method.

## `validateRequest`

Requires bounded non-empty calendar ID and optional opaque page/sync tokens. Errors contain constant text only.

## `addCalendarIdentity`

Requires an object item and overwrites any provider-supplied `calendarId` with the trusted requested collection ID.

## `classifyResponse`

Classifies 401/403 as authorization, 410 as `sync_token_invalid`, 429 and 5xx as transient, and other non-success
statuses as permanent provider failures.

## `validateSecretToken`

Rejects missing or oversized bearer credentials before an adapter is constructed.
