# `src/domain/calendar-write/mutation-execution.ts`

This module runs one confirmed update, move, cancellation, or direct delete,
including reviewed recurrence, attendee, and notification effects.
It checks the exact provider event version before claiming the operation,
calls the selected provider method at most once, and reports verified only
after the disclosed after-state—or provider absence for delete—is read back.

## `executeConfirmedCalendarMutation`

Executes one owner-scoped mutation with stale-target invalidation, one durable
claim, uncertainty reconciliation, safe audit facts, and truthful pending
state.

## `reconcileExistingMutation`

Reuses verified or failed durable state and reconciles a pending operation
without sending a second provider mutation.

## `reconcileMutation`

Reads the provider once after an attempt and marks success only for an exact
after snapshot or confirmed absence.

## `mutationInput`

Converts the immutable after preview into the closed provider mutation input.

## `callMutationProvider`

Dispatches only to the method named by the immutable update, move, or cancel
action.

## `matchesTargetAndSnapshot`

Compares event identity, provider version, all disclosed event facts, and the
approved attendee/recurrence/notification effects.

## `staleMutation`

Returns a closed invalidated proposal for a changed event identity or version.

## `withMutationStatus`

Creates a new immutable mutation lifecycle value without changing the stored
proposal.

## `resultFor`

Builds a safe execution result and includes provider identity only after the
executor has verified it.

## `pendingMutation`

Records conservative pending state and never treats an unknown provider result
as verified.

## `markFailed`

Attempts the failed ledger transition after a definite provider rejection.

## `markVerified`

Requires the durable verified transition to succeed before the executor can
report a verified mutation.

## `writeMutationAudit`

Sends only the existing privacy-safe audit shape and suppresses sink failure.

## `auditForMutation`

Builds a controlled action-specific mutation audit fact.

## `auditId`

Builds a bounded audit identity without event content or provider response
data.

## `auditOwnerId`

Converts an owner identity into the safe audit identifier form.

## `isDefiniteProviderFailure`

Recognizes only the closed provider outcome that may be recorded as failed.

## `sameAttendees`

Compares normalized attendee addresses for exact read-back verification.

## `sameRecurrence`

Compares recurrence scope and rules for exact read-back verification.
