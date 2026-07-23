# Calendar client

Uses fixed CalendarList list/get and Calendars insert endpoints. Pagination, rows, media type, body bytes, IDs, ETags, and time zones are bounded. Calendars insert has no idempotency claim; the repository ledger supplies it.

## `listOwnedSecondaryCalendars`
Uses 250-row pages, detects token cycles, and locally requires exact `Vision`, `owner`, non-primary, non-deleted evidence.
## `createSecondaryCalendar`
POSTs exactly `{summary: "Vision", timeZone}` and marks ambiguous failures uncertain.
## `getCalendar`
Percent-encodes the ID and validates the CalendarList resource.
## `request`
Uses a fixed Google origin and collapses token/provider details.
## `readBoundedJson`
Requires JSON and a one-megabyte maximum.
## `isOwnedVisionEntry`
Independently validates provider filtering.
## `bindOwnership`
Adds the server-verified token subject.
## `isBoundedText`
Applies protocol-specific scalar bounds.
