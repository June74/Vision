# `src/domain/calendar-write/create-execution.ts`

This module carries out one already-confirmed one-off calendar event through
small injected interfaces. It checks the calendar version, prevents duplicate
inserts after an uncertain response, reads the provider state back, records a
safe audit fact, and exposes undo only for a verified event.

## `executeConfirmedCalendarCreate`

Starts only from a confirmed preview. A changed calendar version invalidates
the approval. A create is attempted once; an uncertain result is searched by
its private operation marker rather than inserted again. The result stays
`verification_pending` until the provider event matches the approved preview.

## `undoVerifiedCalendarCreate`

Deletes only the event held by a verified owner-scoped operation. It reports
`undone` after provider absence is confirmed, including a provider not-found
response. An uncertain delete remains pending.

## `reconcileExisting`

Reuses verified or failed ledger state and reconciles a pending operation
without sending a second create.

## `reconcileUncertain`

Looks for exactly one event carrying the operation marker. Zero or multiple
matches remain pending.

## `verifyCreated`

Reads one event back and compares every approved field before marking success.

## `pendingResult`

Stores a conservative pending ledger state and returns an honest unknown
result when provider state is incomplete or mismatched.

## `matchesPreview`

Checks title, description, timing, time zone, domain, privacy, and the
supported empty attendee, recurrence, and notification effects.

## `resultFor`

Builds the safe result returned to the caller and includes undo metadata only
when an event identity and provider version are verified.

## `withProposalStatus`

Creates a new proposal value with a lifecycle status without mutating the
approved proposal.

## `isDefiniteProviderFailure`

Recognizes the closed provider failure category that is safe to mark failed.

## `markPendingSafely`

Attempts the pending ledger transition without turning a ledger failure into a
false provider success.

## `markFailedSafely`

Attempts the failed ledger transition after a definite provider rejection.

## `markUndoneSafely`

Attempts the undone ledger transition after provider absence is verified.

## `writeAuditSafely`

Sends only the existing privacy-safe audit shape. Audit-sink failure does not
upgrade or otherwise change the provider result.

## `auditForCreate`

Builds a create audit record containing only opaque identities and controlled
categories.

## `auditForUndo`

Builds the corresponding privacy-safe compensating-undo audit record.

## `auditId`

Builds a bounded audit identity that separates lifecycle outcomes and does not
include event content or provider response data.

## `auditOwnerId`

Converts the owner identity to the safe audit identifier form.
