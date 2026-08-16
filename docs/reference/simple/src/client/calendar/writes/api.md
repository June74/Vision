# Browser calendar-write API

These helpers let the connected desk ask Vision to prepare, confirm, check, or
undo one narrow one-off event. They send the existing session cookie and CSRF
token where required. The browser receives a safe preview, never a Google token
or calendar authority.

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

## `readWriteResponse`

Converts HTTP failures and malformed JSON into one safe client error.

## `isCalendarWriteResponse`

Checks the public operation response before the UI uses it.

## `isCalendarWritePreview`

Checks that the preview is one-off, attendee-free, and notification-free.

## `isRecord`

Recognizes a plain JSON object.

## `isBoundedIdentity`

Recognizes a short opaque operation handle without control characters.

## `isOneOf`

Checks a value against a controlled public choice list.
