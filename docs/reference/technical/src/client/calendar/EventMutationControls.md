# `src/client/calendar/EventMutationControls.tsx`

## `EventMutationControls`

The control is an inline state machine scoped to one `FoundationEvent`. Its
editing state emits only `{ action, eventId, after }`; the server supplies the
owner, connected calendar, current provider event, version, and complete
before/after snapshot. Confirmation is action-specific and passes through the
same approval, freshness, ledger, provider, read-back, and audit path as the
one-off create surface. A verified response updates the local chronology only
with safe title/time/status fields; a delete removes the row only after
verified provider absence.

## `open`

Initializes update, move, cancellation, or deletion controls from the
server-bounded event projection. Timestamp conversion remains pinned to the
event's recorded IANA timezone.

## `updateDraft`

Performs a local controlled-field update. It cannot call a provider or grant
approval.

## `preview`

Validates the local draft, sends a CSRF-protected mutation preview, and admits
the UI response only when the bounded response contains an immutable preview
and review expiry.

## `confirm`

Uses the opaque operation handle and the action-specific phrase. The browser
does not resend provider event identity, version, or full event content.

## `checkStatus`

Reads the owner-scoped operation status after an uncertain response. It does
not retry the provider mutation.

## `applyResponse`

Accepts only verified, pending, proposed/confirmed, invalidated, or failed
states represented by the browser API parser. Verified state invokes the
parent callback with the safe after snapshot.

## `MutationPreviewDetails`

Renders both immutable snapshots and makes the destructive null after-state
explicit.

## `MutationEventFacts`

Renders only the provider-neutral fields approved for user review.

## `toMutationPatch`

Maps update to a title patch, move to offset-bearing times and timezone,
cancellation to `status: cancelled`, and deletion to `null`.

## `toLocalDateTime`

Uses `Intl.DateTimeFormat` with the event timezone to avoid device-timezone
drift in the edit form.

## `localDateTimeToOffsetIso`

Calculates the timezone offset from a wall-clock input and rejects malformed
values before they reach the API.

## `formatDate`

Uses timezone-pinned `Intl.DateTimeFormat` for preview dates.

## `formatTime`

Uses timezone-pinned `Intl.DateTimeFormat` for preview times.

## `confirmationPhrase`

Keeps the displayed phrase aligned with the server's fixed action allowlist.

## `actionNoun`

Provides bounded action text for preview and verified-state copy.

## `actionVerb`

Provides bounded action text for the local preview submit control.

## `safeControlId`

Creates a DOM identifier from an event ID without placing the identity in
visible content.

## `capitalize`

Formats a finite status enum for display.

## `safeErrorMessage`

Maps 401, 409, 503, and status-refresh failures to constant guidance without
provider payloads.
