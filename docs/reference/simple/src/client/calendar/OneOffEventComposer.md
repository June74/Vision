# One-off event composer

The connected desk starts with a quiet **Add one-off event** action. The person
fills in a title, time, time zone, domain, privacy, and optional description.
Vision then shows the exact proposed change before asking for confirmation.

## `OneOffEventComposer`

Shows the editable draft, immutable preview, honest pending state, verified
undo, and safe recovery message.

## `openComposer`

Starts a fresh empty draft.

## `updateDraft`

Changes one supported form field.

## `preview`

Asks the server to retain and return the proposal.

## `confirm`

Requires the visible preview and sends the deliberate confirmation phrase.

## `checkStatus`

Checks a pending operation without trying to create it again.

## `undo`

Shows and uses undo only after verified creation.

## `applyResponse`

Maps server status to the truthful visible state.

## `PreviewDetails`

Displays only safe preview facts and controlled effects.

## `toApiDraft`

Builds the fixed one-off request shape.

## `localDateTimeToOffsetIso`

Adds the selected IANA time-zone offset to a local browser input.

## `formatPreviewDate`

Formats the preview date for the selected time zone.

## `formatPreviewTime`

Formats the preview clock time for the selected time zone.

## `capitalize`

Turns a controlled enum into readable copy.

## `safeErrorMessage`

Explains recovery without exposing provider or persistence details.

## `storeOperation`

Stores only operation ID and status hint in session storage.

## `clearStoredOperation`

Removes the recovery hint after a terminal result.

## `readStoredOperation`

Reads and validates the bounded recovery hint.

## `isCalendarWriteStatus`

Checks a stored status against the public state list.
