# `src/domain/calendar-write/event-mutation.ts`

This is the provider-neutral event mutation contract. It imports only Zod,
the category/privacy value schemas, and the shared constant-text calendar-write
error. It does not call Hono, Google, Drizzle, crypto, or browser APIs.

## `createCalendarWriteMutationProposal`

**Signature:** `(input: unknown) => CalendarWriteMutationProposal`

Reads a caller-owned object through descriptor checks, validates the exact
operation/action/target/event shape with Zod, checks both intervals, and
applies action-specific rules. `update` requires an after snapshot with the
same status and allows content/effect changes; `move` allows only a
time/timezone change; `cancel` requires the same non-status facts with
`status: "cancelled"`; `delete` requires `after: null`. Single-event and
whole-series scope are explicit, and attendees, recurrence rules, and
notification policy are bounded and compared as part of the proposal. The
returned graph is deep-frozen and includes the opaque calendar/event identity
and expected provider version inside the encrypted approval boundary.

## `restoreCalendarWriteMutationProposal`

**Signature:** `(input: unknown) => CalendarWriteMutationProposal`

Requires the exact persisted root, target, preview, attendee, recurrence, and
notification shapes; accepts proposed single-event or whole-series scope; then
rehydrates through `createCalendarWriteMutationProposal` so semantic action and
interval rules are applied again.

## `transitionCalendarWriteMutation`

**Signature:** `(proposal, transition) => CalendarWriteMutationProposal`

Accepts `approve`, `begin_write`, `verified`, `verification_pending`, `failed`,
and `undone` transitions. Approval compares calendar ID, event ID, expected
version, and scope. A mismatch returns a new `invalidated` value with only the
closed `STALE_EVENT_VERSION` reason. Other illegal transitions throw the shared
`INVALID_STATE_TRANSITION` error.

## `validateActionShape`

**Signature:** `(action, before, after) => void`

Enforces the semantic difference between update, move, cancellation, and
deletion so a preview cannot claim one action while carrying another action's
provider facts.

## `sameNonStatusFields`

**Signature:** `(before, after) => boolean`

Compares every supported event field and reviewed effect except lifecycle
status for cancellation.

## `sameNonTimeFields`

**Signature:** `(before, after) => boolean`

Compares title, description, category, privacy, status, attendees, recurrence,
and notifications while excluding the time fields used by move.

## `sameTimeFields`

**Signature:** `(before, after) => boolean`

Compares start, end, and timezone values to distinguish a real move.

## `toPreviewEvent`

**Signature:** `(event) => CalendarWriteMutationEvent`

Copies validated event facts into the public preview shape, projects attendee
count without exposing addresses at the route boundary, and preserves
recurrence and notification intent without exposing provider-only identity.

## `sameTarget`

**Signature:** `(left, right) => boolean`

Compares all four target facts used for approval: calendar ID, event ID,
provider version, and scope.

## `readMutationInput`

**Signature:** `(input: unknown) => unknown`

Requires the exact root keys and recursively sanitizes the target and event
records before Zod sees them. Getter-backed or inherited objects fail closed.

## `readEventInput`

**Signature:** `(value: unknown) => unknown`

Requires the exact event keys and delegates attendee-array inspection to
`readPlainAttendees`; recurrence and notification values remain closed-schema
data.

## `readPersistedPreviewEvent`

**Signature:** `(value: unknown) => CalendarWriteMutationEventInput`

Validates the canonical nested preview objects, including count-only attendee
descriptors, one-off/occurrence/series recurrence, and notification policy, and
converts the persisted preview facts into the strict constructor input without
invoking accessors.

## `readPlainAttendees`

**Signature:** `(value: unknown) => readonly unknown[]`

Accepts only a dense ordinary array of enumerable data properties and rejects
accessors, symbols, extra properties, and malformed lengths.

## `readPlainRecord`

**Signature:** `(value: unknown) => Record<string, unknown>`

Copies only own enumerable data properties from an ordinary object or null-
prototype record. It never invokes a caller getter.

## `assertExactKeys`

**Signature:** `(value, expected) => void`

Rejects missing or unknown fields before semantic validation.

## `mutationError`

**Signature:** `(code) => CalendarWriteContractError`

Maps the small mutation reason-code set to the shared constant-text error
without reflecting rejected values.

## `invalidTransition`

**Signature:** `() => CalendarWriteContractError`

Creates the shared invalid-lifecycle-transition error.

## `freezeValue`

**Signature:** `(value) => value`

Recursively freezes the newly-created proposal graph while leaving caller-owned
input untouched.

## `validateRecurrenceAndNotificationPolicy`

**Signature:** `(targetScope, event) => void`

Requires series targets to carry series recurrence, rejects series recurrence on
single-event targets, and validates attendee and notification bounds.

## `validateRecurrenceValue`

**Signature:** `(value, targetScope) => void`

Requires prefixed bounded recurrence rules and enforces the one-off,
occurrence, or series rule constraints.

## `recurrenceScope`

**Signature:** `(value) => "one-off" | "occurrence" | "series"`

Projects an internal recurrence value into its public descriptor scope.

## `canonicalizeAttendees`

**Signature:** `(attendees) => string[]`

Lowercases and sorts validated addresses for deterministic protected-state
comparison.

## `sameRecurrence`

**Signature:** `(left, right) => boolean`

Compares recurrence scope and each bounded rule in order.
