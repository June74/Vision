# Calendar client

Uses fixed CalendarList list/get and Calendars insert endpoints. A capped deadline races both headers and every streamed body read through an AbortController. Chunks and bytes are bounded before accumulation. Overflow or deadline aborts the request and starts best-effort reader cancellation without awaiting hostile cleanup. Calendars insert has no idempotency claim; the repository ledger supplies it.

## `listOwnedSecondaryCalendars`
Uses 250-row pages, detects token cycles, and locally requires exact `Vision`, `owner`, non-primary, non-deleted evidence.
## `createSecondaryCalendar`
POSTs exactly `{summary: "Vision", timeZone}` and marks ambiguous failures uncertain.
## `getCalendar`
Percent-encodes the ID and validates the CalendarList resource.
## `request`
Uses a fixed Google origin and collapses token/provider details.
## `readBoundedJson`
Requires JSON, incrementally enforces the one-megabyte and 4,096-chunk ceilings, and never calls unbounded `text()` or `json()`.
## `cancelReaderSafely`
Observes cancellation rejection while detaching cleanup so a never-settling stream cannot outlive the request deadline.
## `isOwnedVisionEntry`
Independently validates provider filtering.
## `bindOwnership`
Adds the server-verified token subject.
## `isBoundedText`
Applies protocol-specific scalar bounds.
## `readPositiveBound`
Allows test overrides only below the 30-second and one-megabyte production ceilings.
