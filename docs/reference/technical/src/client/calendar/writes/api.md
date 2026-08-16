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

## `previewCalendarEventMutation`

POSTs only `{ action, eventId, after }` with the existing session cookie and
CSRF token. The server derives the connected calendar, provider event, and
version before encrypting the proposal.

## `confirmCalendarEventMutation`

POSTs the opaque operation handle and an action-derived fixed phrase. It never
accepts browser-supplied provider identity or version fields.

## `readCalendarEventMutationStatus`

GETs owner-scoped mutation state for pending/reload recovery without retrying
the provider operation.

## `readWriteResponse`

Maps non-2xx responses and malformed payloads to `CalendarWriteApiError` with a
status and optional safe code. Provider bodies and response URLs are discarded.

## `isCalendarWriteResponse`

Validates the bounded public envelope and the closed operation-status union.

## `readMutationResponse`

Parses the bounded mutation response and maps non-2xx or malformed responses to
`CalendarWriteApiError` without echoing response data.

## `isCalendarMutationResponse`

Requires an opaque operation ID, one allowlisted action, a finite lifecycle
status, and a boolean undo flag.

## `isCalendarMutationPreview`

Requires a complete before snapshot and either a complete after snapshot or an
explicit null deletion outcome.

## `isCalendarMutationEvent`

Rejects provider-only fields and admits only attendee-free, recurrence-free,
notification-free event facts.

## `isCalendarWriteStatus`

Centralizes lifecycle status validation for both write surfaces.

## `mutationConfirmationPhrase`

Keeps browser confirmation text synchronized with the server's action
allowlist.

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
