# One-off event composer

`OneOffEventComposer` is composed only inside the authenticated connected
`FoundationDesk`. Its state machine is deliberately narrower than the server:
`closed -> editing -> preview -> pending -> verified -> undone`, with an error
state that clears or replaces stale operation hints. Confirmation is disabled
until a server preview exists. HTTP 202 is rendered as `Verification pending`
and exposes only `Check status`; the UI never claims provider success early.

## `OneOffEventComposer`

Owns local draft state, async action state, and session-storage recovery while
delegating authority to the browser API module.

## `openComposer`

Initializes only editable fields. It never initializes owner, calendar, token,
provider event identity, or provider version.

## `updateDraft`

Performs typed local updates over the six supported user-facing fields.

## `preview`

Converts `datetime-local` values to offset-bearing ISO strings, fixes empty
description to `null`, and calls `previewOneOffEvent`.

## `confirm`

Calls `confirmOneOffEvent` with the stored operation ID and preserves the
server-returned preview as the display source.

## `checkStatus`

Calls `readOneOffEventStatus` exactly once per explicit check action; it cannot
claim a second create.

## `undo`

Calls `undoOneOffEvent` only from `verified` and renders `Undone` only for the
server's terminal absence-confirmed result.

## `applyResponse`

Projects `verified`, `verification_pending`, `proposed`, `undone`, `failed`, and
`invalidated` into distinct user-visible states.

## `PreviewDetails`

Renders server preview fields and controlled effects without provider metadata.

## `toApiDraft`

Enforces non-empty title, valid ordered times, and the fixed no-attendee,
no-recurrence, no-notification contract before the request leaves the browser.

## `localDateTimeToOffsetIso`

Uses `Intl.DateTimeFormat` with the selected IANA zone to derive the offset and
preserves the person's entered wall-clock value.

## `formatPreviewDate`

Uses the preview's declared zone rather than the device zone.

## `formatPreviewTime`

Displays start/end clock values in the preview's declared zone.

## `capitalize`

Formats a closed enum without accepting arbitrary display HTML or provider text.

## `safeErrorMessage`

Maps 409/503/unknown failures to constant recovery copy.

## `storeOperation`

Writes only `{ operationId, status }` to `sessionStorage`; it never writes the
proposal or provider metadata.

## `clearStoredOperation`

Removes the non-authoritative hint after verified undo or invalidation.

## `readStoredOperation`

Treats storage as an optional hint and immediately validates its shape.

## `isCalendarWriteStatus`

Restricts recovery hints to the server's public status union.
