# `src/domain/calendar-write/mutation-execution.ts`

This module is the provider-neutral execution boundary for the event mutation
contract. It imports only the safe audit type, existing provider and
ledger ports, and the immutable mutation value object. It does not make HTTP,
database, crypto, Worker, or browser calls directly.

## `executeConfirmedCalendarMutation`

**Signature:** `(proposal: CalendarWriteMutationProposal, dependencies: CalendarWriteMutationExecutionDependencies) => Promise<CalendarWriteMutationExecutionResult>`

Requires a confirmed proposal, checks the owner-scoped ledger before provider
I/O, reads the target event and requires exact event ID/version and before
facts, then claims one operation. Update, move, and cancel call only their
selected provider method; delete calls the existing version-guarded delete.
Definite errors become failed, uncertain errors trigger one read-back, and
success requires the complete after snapshot or provider absence. A failed
verified-ledger write remains `verification_pending`.

## `reconcileExistingMutation`

**Signature:** `(proposal, record, dependencies) => Promise<CalendarWriteMutationExecutionResult>`

Projects verified, failed, and undone durable records without a provider
mutation. Writing or pending records enter one read-back reconciliation.

## `reconcileMutation`

**Signature:** `(proposal, dependencies, pendingCategory) => Promise<CalendarWriteMutationExecutionResult>`

Reads the event exactly once after the attempt. Non-delete actions require
matching target identity/version, status, protected event facts, and approved
attendee, recurrence, and notification effects. Delete requires `undefined`
absence.

## `mutationInput`

**Signature:** `(proposal) => CalendarWriteMutationProviderInput`

Projects the immutable after preview into the provider port and carries the
expected event version as a separate freshness guard. Delete never calls this
function because it has no after snapshot.

## `callMutationProvider`

**Signature:** `(provider, action, input) => Promise<CalendarWriteProviderEvent>`

Selects only `updateEvent`, `moveEvent`, or `cancelEvent` from the closed
action union. No dynamic provider method or retry path is introduced.

## `matchesTargetAndSnapshot`

**Signature:** `(proposal, event, snapshot) => boolean`

Compares provider event ID/version, title, description, timing, timezone,
domain, privacy, status, attendees, recurrence, and notification policy.

## `staleMutation`

**Signature:** `(proposal) => CalendarWriteMutationProposal`

Returns a frozen invalidated value with only `STALE_EVENT_VERSION` as the
provider-neutral reason.

## `withMutationStatus`

**Signature:** `(proposal, status) => CalendarWriteMutationProposal`

Returns a frozen lifecycle copy and adds the closed invalidation reason only
for invalidated values.

## `resultFor`

**Signature:** `(proposal, status, record?) => CalendarWriteMutationExecutionResult`

Projects owner/operation/proposal state and includes event identity/version
only when the durable verified record supplies both.

## `pendingMutation`

**Signature:** `(proposal, dependencies, errorCategory, markLedger) => Promise<CalendarWriteMutationExecutionResult>`

Attempts a pending ledger transition when a mutation was claimed, writes a
controlled pending audit event, and returns no provider identity as verified.

## `markFailed`

**Signature:** `(dependencies, proposal) => Promise<void>`

Attempts the failed ledger transition after a definite provider outcome.

## `markVerified`

**Signature:** `(dependencies, proposal, eventId, eventVersion) => Promise<boolean>`

Returns true only when the durable verified transition succeeds. A persistence
failure forces the public result back to pending.

## `writeMutationAudit`

**Signature:** `(dependencies, event: SafeAuditEvent) => Promise<void>`

Sends the closed audit value and suppresses sink failures without changing the
provider classification.

## `auditForMutation`

**Signature:** `(proposal, outcome, occurredAt, errorCategory?) => SafeAuditEvent`

Creates `calendar.event.update|move|cancel|delete` audit facts with opaque
owner/operation IDs and controlled categories only.

## `auditId`

**Signature:** `(operationId, action, outcome, occurredAt, errorCategory?) => string`

Bounds and sanitizes lifecycle identity components without retaining event
content, URLs, tokens, or provider bodies.

## `auditOwnerId`

**Signature:** `(ownerId: string) => string`

Converts the validated owner identity to the lowercase audit alphabet.

## `isDefiniteProviderFailure`

**Signature:** `(error: unknown) => boolean`

Narrows only `CalendarWriteProviderError("definite_failure")`; all other
errors remain conservative uncertainty.

## `sameAttendees`

**Signature:** `(left, right) => boolean`

Compares lowercased sorted attendee addresses so provider ordering does not
create a false verification failure.

## `sameRecurrence`

**Signature:** `(left, right) => boolean`

Requires equal recurrence scope and equal rule sequence for exact read-back.
