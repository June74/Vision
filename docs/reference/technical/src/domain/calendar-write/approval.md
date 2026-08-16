# `src/domain/calendar-write/approval.ts`

This provider-neutral module is the first Phase C write boundary. It has no
Google, Worker, database, crypto, or browser imports. Provider-facing code in a
later increment must consume the frozen proposal and state transitions rather
than recreate validation.

## `createCalendarWriteProposal`

**Signature:** `createCalendarWriteProposal(input: unknown): CalendarWriteProposal`

Validates strict owner, operation, target-calendar, timestamp, category,
privacy, and one-off event fields. It requires `endsAt > startsAt`, accepts an
empty attendee list, requires `recurrence: null`, and requires
`notifications: "none"`. It produces an immutable `before: null` and exact
after preview with no attendee notification effect.

## `transitionCalendarWrite`

**Signature:** `transitionCalendarWrite(operation, transition): CalendarWriteProposal`

The transition graph is `proposed -> confirmed -> writing -> verified | verification_pending | failed`; stale approval becomes `invalidated`. It returns a new frozen value and throws only the constant `INVALID_STATE_TRANSITION` or returns the constant stale reason.

## `CalendarWriteContractError`

**Signature:** `new CalendarWriteContractError(code: CalendarWriteReasonCode)`

The error exposes only one closed reason code and uses constant message text.
The codes distinguish invalid input, unsupported attendees, unsupported
recurrence, unsupported notifications, stale target version, and illegal state
transition.

## Security boundary

Descriptor inspection rejects symbols, accessors, inherited enumerable data,
unknown fields, and malformed values before provider or persistence code can
consume them. Error messages do not include title, attendee, calendar, or
operation values. Covered by
`tests/unit/domain/calendar-write-approval.test.ts`.

## `readPlainRecord`

**Signature:** `readPlainRecord(value: unknown): Record<string, unknown>`

Requires a plain object or null-prototype object, inspects own descriptors, and
copies only enumerable string data properties into a null-prototype record.

## `readPlainAttendees`

**Signature:** `readPlainAttendees(value: unknown): readonly unknown[]`

Requires a dense native array of at most 50 entries and rejects accessors,
sparse indexes, symbols, and extra properties before Zod sees the values.

## `readProposalInput`

**Signature:** `readProposalInput(input: unknown): unknown`

Normalizes the root, target, event, and attendee descriptors and rejects
unsupported attendee, recurrence, and notification effects before parsing.

## `invalidProposal`

**Signature:** `invalidProposal(): CalendarWriteContractError`

Returns the constant `INVALID_PROPOSAL_INPUT` error.

## `invalidTransition`

**Signature:** `invalidTransition(): CalendarWriteContractError`

Returns the constant `INVALID_STATE_TRANSITION` error.

## `freezeValue`

**Signature:** `freezeValue<T>(value: T): T`

Recursively freezes the newly-created plain data graph without reading
accessor properties. It is used only on values owned by this module.
