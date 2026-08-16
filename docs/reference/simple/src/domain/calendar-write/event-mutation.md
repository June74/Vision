# `src/domain/calendar-write/event-mutation.ts`

This module describes one-off event changes before they reach Google Calendar.
It preserves the exact event identity and version, shows immutable before and
after facts, and rejects recurrence scope until that behavior has its own
acceptance contract.

## `createCalendarWriteMutationProposal`

Builds an immutable update, move, cancellation, or direct-delete proposal.
Update and move show both snapshots; cancellation changes only status; delete
has no after snapshot. Unknown keys, unsupported attendees/recurrence/
notifications, and series scope fail with constant reason codes.

## `transitionCalendarWriteMutation`

Requires an exact target identity and provider version before confirmation, then
allows only the approved proposal to enter writing and a terminal state. A
changed calendar, event, version, or scope invalidates the proposal.

## `validateActionShape`

Checks that each action's before/after meaning is honest.

## `sameNonStatusFields`

Compares the supported event fields except lifecycle status for cancellation.

## `sameNonTimeFields`

Compares the supported event fields except time fields for a move.

## `sameTimeFields`

Compares start, end, and timezone values to distinguish a real move.

## `toPreviewEvent`

Converts an accepted event into the provider-neutral preview shape.

## `sameTarget`

Compares the full mutation target.

## `readMutationInput`

Inspects the root mutation shape without invoking caller accessors.

## `readEventInput`

Inspects one event snapshot and its bounded attendee array.

## `readPlainAttendees`

Accepts only a dense ordinary attendee array with data properties.

## `readPlainRecord`

Copies only own enumerable data properties from a plain object.

## `assertExactKeys`

Rejects unknown or missing fields before semantic validation.

## `mutationError`

Produces a stable provider-free contract error.

## `invalidTransition`

Produces the stable invalid-lifecycle-transition error.

## `freezeValue`

Prevents callers from mutating an approved proposal graph.
