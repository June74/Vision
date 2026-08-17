# Browser calendar-write API

These helpers let the connected desk ask Vision to prepare, confirm, check, or
undo one narrow event mutation. They send the existing session cookie and CSRF
token where required. The browser receives a safe preview, never a Google token
or calendar authority; attendee addresses are redacted to count-only metadata.

## `previewOneOffEvent`

Saves a proposed event for review and returns its opaque operation ID and exact
before/after preview.

## `confirmOneOffEvent`

Sends the fixed confirmation phrase for the retained operation. It never sends
the event again.

## `readOneOffEventStatus`

Asks the server for owner-scoped truth after a reload or an uncertain result.

## `undoOneOffEvent`

Requests the fixed compensating-undo phrase for a verified operation.

## `previewCalendarEventMutation`

Creates a server-derived before/after preview for one event update, move,
cancellation, or deletion, with optional single/series scope and reviewed
attendee, recurrence, and notification intent.

## `confirmCalendarEventMutation`

Sends the exact confirmation phrase for the selected mutation action.

## `readCalendarEventMutationStatus`

Reads an owner-scoped mutation after an uncertain provider result.

## `readWriteResponse`

Converts HTTP failures and malformed JSON into one safe client error.

## `isCalendarWriteResponse`

Checks the public operation response before the UI uses it.

## `readMutationResponse`

Converts mutation HTTP failures and malformed JSON into the safe calendar-write
API error.

## `isCalendarMutationResponse`

Checks the bounded mutation operation response before rendering it.

## `isCalendarMutationPreview`

Checks the exact before/after mutation snapshot, including a null deletion
after-state.

## `isCalendarMutationEvent`

Checks the safe event descriptors used by mutation previews, including bounded
attendee counts, recurrence metadata, and notification policy.

## `isCalendarWriteStatus`

Checks the finite lifecycle state shared by create and mutation operations.

## `mutationConfirmationPhrase`

Returns the fixed action-specific confirmation phrase.

## `isCalendarWritePreview`

Checks that the create preview is one-off, attendee-free, and
notification-free; mutation previews use the broader reviewed event contract.

## `isRecord`

Recognizes a plain JSON object.

## `isBoundedIdentity`

Recognizes a short opaque operation handle without control characters.

## `isOneOf`

Checks a value against a controlled public choice list.
