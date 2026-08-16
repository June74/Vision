# `src/integrations/google-calendar/event-write-client.ts`

This module implements the `CalendarWriteProvider` port against Google
Calendar API v3. It is deliberately separate from the read-only event
synchronization adapter. The origin is fixed to
`https://www.googleapis.com/calendar/v3`; callers cannot supply an arbitrary
URL. Access tokens, provider bodies, and URLs never enter thrown error text.

Calendar IDs and ETags are bounded provider values rather than Vision opaque
IDs: Google secondary-calendar identifiers may be email-shaped and ETags may
be quoted. Control characters are rejected before URL or `If-Match` use.

## `createGoogleEventWriteClient`

**Signature:** `(options: GoogleEventWriteClientOptions) => CalendarWriteProvider`

Snapshots a nonempty access token, validates the deadline and response byte
limit, and returns exactly five provider methods. The adapter fixes the event
write policy to no attendees, no recurrence, and `sendUpdates=none`.

## `readCalendarVersion`

**Signature:** `(calendarId: string) => Promise<{ calendarId: string; version: string }>`

Performs a GET on `/calendars/{calendarId}` and accepts only JSON containing a
matching calendar ID and bounded nonempty ETag. Transport or HTTP failure is a
definite provider failure because no mutation is in flight.

## `createOneOffEvent`

**Signature:** `(input: CalendarWriteProvider create input) => Promise<CalendarWriteProviderEvent>`

POSTs to `/calendars/{calendarId}/events?sendUpdates=none`. The body contains
only summary, optional description, timed start/end, and private
`vision.operationId`, `vision.domain`, and `vision.privacy` properties. The
response must normalize as a confirmed timed event carrying the expected
operation marker. A 5xx, timeout, transport error, or malformed success is
`uncertain`; a definite 4xx is `definite_failure`.

## `findByOperationId`

**Signature:** `(input: { calendarId: string; operationId: string }) => Promise<readonly CalendarWriteProviderEvent[]>`

GETs `/events` with `showDeleted=false`, `singleEvents=false`, a bounded
`maxResults`, and the encoded `privateExtendedProperty` marker. Every returned
item must pass the same strict one-off normalization before the executor can
use it for reconciliation.

## `readEvent`

**Signature:** `(input: { calendarId: string; eventId: string }) => Promise<CalendarWriteProviderEvent | undefined>`

GETs one encoded event. Provider 404 is represented as `undefined`; all other
malformed or unexpected responses remain conservative failures.

## `deleteEvent`

**Signature:** `(input: { calendarId: string; eventId: string; expectedVersion: string }) => Promise<"deleted" | "not_found">`

DELETEs the encoded event with `sendUpdates=none` and the exact `If-Match`
version. A 204 response is `deleted`; a 404 is `not_found`; an ambiguous
mutation response is `uncertain` through `CalendarWriteProviderError`.

## `buildEventsUrl`

**Signature:** `(calendarId: string, parameters: Record<string, string>) => string`

Builds a URL below the fixed API origin, encodes the calendar and event path
segments, and uses `URLSearchParams` for query values. `eventId` is kept in the
path rather than the query.

## `validateCreateInput`

**Signature:** `(input: CalendarWriteProvider create input) => void`

Checks provider-safe calendar and operation identities, bounded event fields,
chronological time, and the closed Phase C effects. Invalid input raises only
`CalendarWriteProviderError("definite_failure")`.

## `normalizeEvent`

**Signature:** `(value: unknown, expectedOperationId?: string) => CalendarWriteProviderEvent`

Validates the bounded Google response with Zod, requires a confirmed timed
event, requires all three private markers, rejects attendees and recurrence,
requires matching start/end time zones, and returns only the provider-neutral
fields used by exact read-back.

## `requestJson`

**Signature:** `(url, init, mutationMayHaveSucceeded, notFoundAllowed, fetcher, deadlineMs, maxBodyBytes, accessToken) => Promise<unknown | symbol | undefined>`

Races fetch against one abort deadline, fixes the bearer and JSON headers,
classifies statuses without retaining response bodies, handles the two allowed
404 absence cases, and delegates successful body parsing to `readBoundedJson`.

## `readBoundedJson`

**Signature:** `(response, controller, deadline, maxBodyBytes) => Promise<unknown>`

Requires an application/json media type, reads at most the configured byte and
chunk limits, cancels the stream on overflow or parse failure, and uses fatal
UTF-8 decoding before JSON parsing.

## `isUncertainStatus`

**Signature:** `(status: number) => boolean`

Classifies 408, 429, and 5xx statuses as potentially ambiguous for mutations.

## `assertOpaqueId`

**Signature:** `(value: unknown) => asserts value is string`

Checks the closed operation/event identifier grammar and emits a constant
definite failure on rejection.

## `assertProviderText`

**Signature:** `(value: unknown, maximum: number) => asserts value is string`

Checks a bounded provider calendar ID or version and rejects ASCII control
characters before path or header use.

## `isProviderText`

**Signature:** `(value: unknown, maximum: number) => value is string`

Provides the non-throwing provider-text predicate used by the assertion and
version checks.

## `isBoundedText`

**Signature:** `(value: unknown, maximum: number) => value is string`

Checks nonempty bounded strings without formatting the rejected value.

## `readPositiveBound`

**Signature:** `(value: unknown, maximum: number) => number`

Accepts only safe positive integers at or below the reviewed ceiling for
deadlines and response limits.
