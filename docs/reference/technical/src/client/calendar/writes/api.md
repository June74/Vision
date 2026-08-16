# Browser calendar-write API

The module is the browser-side adapter for the four authenticated routes:
`POST /api/calendar/writes/preview`, `GET /api/calendar/writes/:operationId`,
`POST .../confirm`, and `POST .../undo`. Mutations use same-origin credentials
and `x-vision-csrf`; status reads use credentials without CSRF. The parser
accepts only bounded operation IDs, controlled statuses, optional expiry, the
immutable preview, and `undoAvailable`.

## `previewOneOffEvent`

Serializes only title, nullable description, offset-bearing timestamps, time
zone, domain, and privacy. It adds fixed `attendees: []`, `recurrence: null`,
and `notifications: "none"`.

## `confirmOneOffEvent`

Sends `{ confirmation: "CONFIRM ONE-OFF EVENT" }` with no proposal replay.

## `readOneOffEventStatus`

URL-encodes the opaque operation handle and recovers authoritative status after
reload or a provider-uncertain response.

## `undoOneOffEvent`

Sends `{ confirmation: "UNDO ONE-OFF EVENT" }`; event ID, calendar ID, and
provider version remain server-side ledger fields.

## `readWriteResponse`

Maps non-2xx responses and malformed payloads to `CalendarWriteApiError` with a
status and optional safe code. Provider bodies and response URLs are discarded.

## `isCalendarWriteResponse`

Validates the bounded public envelope and the closed operation-status union.

## `isCalendarWritePreview`

Requires `before: null`, controlled domain/privacy, empty attendee and recurrence
lists, and `notifications.willNotify === false`.

## `isRecord`

Narrows unknown JSON without accepting arrays as property bags.

## `isBoundedIdentity`

Bounds the only browser-retained authority handle to 512 characters and rejects
control characters.

## `isOneOf`

Provides the generic controlled-enum check used by the response decoder.
