# `src/domain/calendar-write/event-mutation.ts`

This is the provider-neutral one-off mutation contract. It imports only Zod,
the category/privacy value schemas, and the shared constant-text calendar-write
error. It does not call Hono, Google, Drizzle, crypto, or browser APIs.

## `createCalendarWriteMutationProposal`

**Signature:** `(input: unknown) => CalendarWriteMutationProposal`

Reads a caller-owned object through descriptor checks, validates the exact
operation/action/target/event shape with Zod, rejects `series` scope, checks
both intervals, and applies action-specific rules. `update` requires an after
snapshot with the same status and allows content changes; `move` allows only a
time/timezone change; `cancel` requires the same non-status facts with
`status: "cancelled"`; `delete` requires `after: null`. The returned graph is
deep-frozen and includes the opaque calendar/event identity and expected
provider version inside the encrypted approval boundary.

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

Compares every supported event field except lifecycle status for cancellation.

## `sameNonTimeFields`

**Signature:** `(before, after) => boolean`

Compares title, description, category, privacy, status, and fixed one-off
effects while excluding the time fields used by move.

## `sameTimeFields`

**Signature:** `(before, after) => boolean`

Compares start, end, and timezone values to distinguish a real move.

## `toPreviewEvent`

**Signature:** `(event) => CalendarWriteMutationEvent`

Copies validated event facts into the public preview shape and projects the
currently supported empty attendee, one-off recurrence, and notification-none
policies without exposing provider-only identity.

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

Requires the exact one-off event keys and delegates attendee-array inspection
to `readPlainAttendees`.

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
