# `src/domain/calendar-write/create-execution.ts`

This module is the provider-neutral execution boundary for the first connected
calendar write. It imports the approval contract and privacy-safe audit type,
but no Hono, Drizzle, Google SDK, or browser code. Server composition supplies
the provider, durable ledger, audit sink, and clock.

## `executeConfirmedCalendarCreate`

**Signature:** `(proposal: CalendarWriteProposal, dependencies: CalendarWriteExecutionDependencies) => Promise<CalendarWriteExecutionResult>`

Requires `proposal.status === "confirmed"`. It checks an existing owner and
operation ledger record before touching the provider, reads the latest target
calendar version, invalidates a stale target before claiming, claims one
operation, and calls `createOneOffEvent` at most once. Definite provider errors
become `failed`; uncertain errors call `findByOperationId` and never retry the
insert. A single marker match is read back and must match every approved field
before the ledger becomes `verified`.

## `undoVerifiedCalendarCreate`

**Signature:** `(request: CalendarWriteUndoRequest, dependencies: CalendarWriteExecutionDependencies) => Promise<CalendarWriteUndoResult>`

Requires an owner-scoped `verified` ledger record with calendar ID, event ID,
and provider version. It calls `deleteEvent` with `expectedVersion`, accepts a
provider `not_found` result as already absent, and otherwise reads the event
back before marking `undone`. A transport or read-back uncertainty remains
`verification_pending`; an `undone` replay makes no provider call.

## `reconcileExisting`

**Signature:** `(proposal, record, dependencies) => Promise<CalendarWriteExecutionResult>`

Maps verified, failed, and undone durable states without a duplicate insert.
Pending or writing state enters marker reconciliation.

## `reconcileUncertain`

**Signature:** `(proposal, dependencies) => Promise<CalendarWriteExecutionResult>`

Calls the marker lookup once for the current attempt. Exactly one candidate is
passed to read-back; zero or multiple candidates produce a pending result.

## `verifyCreated`

**Signature:** `(proposal, created, dependencies) => Promise<CalendarWriteExecutionResult>`

Reads the provider event by opaque event ID and calls `matchesPreview`. The
ledger is marked verified only after the read-back and ledger update both
succeed. The returned undo object contains no event content.

## `pendingResult`

**Signature:** `(proposal, dependencies, errorCategory) => Promise<CalendarWriteExecutionResult>`

Marks the operation `verification_pending` on a best-effort basis and writes a
controlled pending audit category. It cannot report success from an unknown
provider result.

## `matchesPreview`

**Signature:** `(proposal, event) => boolean`

Compares operation marker, title, nullable description, start and end
timestamps, time zone, concrete domain, privacy level, and the empty attendee,
null recurrence, and `none` notification contract.

## `resultFor`

**Signature:** `(proposal, status, record?) => CalendarWriteExecutionResult`

Copies only owner/operation/proposal state into the result and adds event or
undo metadata when both opaque provider identity and version exist.

## `withProposalStatus`

**Signature:** `(proposal, status) => CalendarWriteProposal`

Returns a frozen lifecycle copy. Invalidated proposals carry only the closed
`STALE_TARGET_VERSION` reason.

## `isDefiniteProviderFailure`

**Signature:** `(error: unknown) => boolean`

Narrows only `CalendarWriteProviderError` with the `definite_failure` outcome;
all other thrown values remain conservative uncertainty.

## `markPendingSafely`

**Signature:** `(dependencies, proposal) => Promise<void>`

Attempts the pending ledger transition and intentionally suppresses ledger
errors so an unavailable ledger cannot create a stronger provider claim.

## `markFailedSafely`

**Signature:** `(dependencies, proposal) => Promise<void>`

Attempts the failed ledger transition after a definite provider rejection.

## `markUndoneSafely`

**Signature:** `(dependencies, request) => Promise<void>`

Attempts the final undo ledger transition after absence is verified.

## `writeAuditSafely`

**Signature:** `(dependencies, event: SafeAuditEvent) => Promise<void>`

Sends the closed audit event through the injected writer and suppresses sink
failure without changing the provider result. The event contains no title,
description, attendee, token, URL, or provider body.

## `auditForCreate`

**Signature:** `(proposal, outcome, occurredAt, errorCategory?) => SafeAuditEvent`

Creates the `calendar.event.create` audit fact with the Google provider code,
opaque owner/operation identities, and an optional controlled error category.

## `auditForUndo`

**Signature:** `(request, outcome, occurredAt, errorCategory?) => SafeAuditEvent`

Creates the analogous `calendar.event.undo` fact.

## `auditId`

**Signature:** `(operationId, suffix, outcome, occurredAt, errorCategory?) => string`

Sanitizes and bounds the identity for `SafeAuditEvent`. The lifecycle suffix,
outcome, category, and compact timestamp distinguish pending, success, denial,
failure, and undo observations while retaining no free-form content.

## `auditOwnerId`

**Signature:** `(ownerId: string) => string`

Converts the already contract-validated owner identity to the audit schema's
lowercase opaque identifier format and applies its maximum length.
