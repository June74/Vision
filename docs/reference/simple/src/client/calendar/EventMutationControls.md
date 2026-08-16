# `src/client/calendar/EventMutationControls.tsx`

## `EventMutationControls`

Adds an authenticated event-change control to each synchronized event. The user
chooses update, move, cancellation, or deletion, reviews the server-derived
before/after facts, confirms the exact action phrase, and sees verified or
pending state. Provider IDs, versions, tokens, and raw provider responses stay
out of the browser display.

## `open`

Opens a fresh local form using only the displayed event facts.

## `updateDraft`

Changes one supported local form field without changing server state.

## `preview`

Sends the narrow mutation patch to the authenticated preview route.

## `confirm`

Sends the action-specific confirmation through the shared mutation route.

## `checkStatus`

Refreshes an unresolved mutation without issuing another provider mutation.

## `applyResponse`

Maps the authoritative mutation response to preview, pending, verified, or
error UI state.

## `MutationPreviewDetails`

Shows the immutable before and after facts, including the explicit deletion
outcome.

## `MutationEventFacts`

Displays title, time, timezone, status, and notification policy from one safe
event snapshot.

## `toMutationPatch`

Converts one local action form into the server's small patch contract.

## `toLocalDateTime`

Formats a provider timestamp in its recorded timezone for an editable control.

## `localDateTimeToOffsetIso`

Converts a local wall-clock control value into an offset-bearing timestamp.

## `formatDate`

Formats a preview date in the event's declared timezone.

## `formatTime`

Formats a preview time in the event's declared timezone.

## `confirmationPhrase`

Returns the exact phrase displayed for one mutation action.

## `actionNoun`

Returns short action copy for headings and verified-state text.

## `actionVerb`

Returns short action copy for the preview button.

## `safeControlId`

Builds a DOM-safe identifier without displaying the source event identity.

## `capitalize`

Turns one finite status into sentence-case display text.

## `safeErrorMessage`

Maps API failures to constant, provider-free user guidance.
