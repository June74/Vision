# `src/domain/calendar-write/event-mutation.ts`

This module describes event changes before they reach Google Calendar. It
preserves the exact event identity and version, shows immutable before and
after facts, and keeps recurrence scope, attendees, and notification intent in
the reviewed proposal.

## `createCalendarWriteMutationProposal`

Builds an immutable update, move, cancellation, or direct-delete proposal.
Update and move show both snapshots; cancellation changes only status; delete
has no after snapshot. Single-event and whole-series scope are explicit.
Attendees, bounded recurrence rules, and `none` or `provider-default`
notifications are validated together with the action.

## `restoreCalendarWriteMutationProposal`

Rehydrates only the exact persisted proposed shape, including attendee counts,
recurrence rules, and notification policy, and sends its normalized facts back
through the same strict mutation constructor.

## `transitionCalendarWriteMutation`

Requires an exact target identity and provider version before confirmation, then
allows only the approved proposal to enter writing and a terminal state. A
changed calendar, event, version, or scope invalidates the proposal.

## `validateActionShape`

Checks that each action's before/after meaning is honest.

## `sameNonStatusFields`

Compares the supported event fields and reviewed effects except lifecycle status
for cancellation.

## `sameNonTimeFields`

Compares the supported event fields and reviewed effects except time fields for
a move.

## `sameTimeFields`

Compares start, end, and timezone values to distinguish a real move.

## `toPreviewEvent`

Converts an accepted event into the provider-neutral preview shape.

## `sameTarget`

Compares the full mutation target.

## `readMutationInput`

Inspects the root mutation shape without invoking caller accessors.

## `readEventInput`

Inspects one event snapshot, its bounded attendee array, recurrence rules, and
notification policy.

## `readPersistedPreviewEvent`

Inspects the canonical nested before/after preview shape from encrypted JSON,
including count-only attendee descriptors and recurrence metadata.

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

## `validateRecurrenceAndNotificationPolicy`

Checks that target scope, recurrence scope, attendee addresses, and notification
policy agree before a proposal is accepted.

## `validateRecurrenceValue`

Checks bounded RRULE, EXDATE, and RDATE values against the selected recurrence
scope.

## `recurrenceScope`

Maps the internal recurrence value to its public one-off, occurrence, or series
descriptor.

## `canonicalizeAttendees`

Normalizes attendee addresses for comparison while keeping them inside the
protected proposal boundary.

## `sameRecurrence`

Compares recurrence scope and ordered rules without provider-specific fields.
