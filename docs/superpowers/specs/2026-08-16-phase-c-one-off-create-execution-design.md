# Phase C One-Off Create Execution Design

## Decision

The next Phase C increment will consume the existing provider-neutral
`CalendarWriteProposal` contract through a provider-neutral execution core and
one bounded Google Calendar event-write adapter. The core starts only from a
confirmed proposal, re-reads the target calendar version immediately before
mutation, performs one idempotent create, reconciles an uncertain result by a
private operation marker, reads the event back, and exposes a compensating undo
operation only after verified creation.

This increment is backend-core work. It will not register an HTTP route, add a
browser confirmation control, deploy, or call a live Google account. Those
surfaces will be wired only after the injected execution path and provider
contract tests are green.

## Boundaries

- `approval.ts` remains authoritative for proposal shape, exact preview,
  explicit approval, and stale-target invalidation.
- The execution core imports neither Hono nor Drizzle nor Google SDK types;
  it depends on small injected ports.
- The Google adapter uses fixed-origin Calendar API endpoints, bounded
  request/response data, and constant safe errors.
- A create sends `sendUpdates=none`, no attendees, no recurrence, and private
  extended properties for the opaque operation ID, domain, and privacy.
- A lost or ambiguous response never causes a second insert. Zero or multiple
  marker matches remain `verification_pending`.
- Read-back must match every approved field before a result is `verified`.
- Audit facts contain only opaque IDs and controlled categories; event content
  never enters the audit port.
- Undo is a compensating delete of the one verified event, guarded by its
  provider version and followed by a not-found read-back. An uncertain undo is
  pending and is never reported as complete.

## Ports and state

The core defines injected ports for: reading the target calendar version,
creating one event, finding events by operation marker, reading one event,
deleting one event with an expected version, claiming/recording an operation,
and writing an existing privacy-safe audit event.

The create path is:

`confirmed proposal -> latest target read -> stale invalidation | ledger claim -> writing -> provider create | reconcile -> read-back -> verified | verification_pending | failed`

Undo begins only from a verified ledger record:

`verified -> undo requested -> provider delete -> not-found read-back -> undone | verification_pending`

## Error policy

- A stale target invalidates before provider mutation.
- A definite provider rejection becomes `failed` and requires a new operation
  ID for a later attempt.
- A timeout, transport failure after mutation may have started, malformed
  success payload, or unknown read-back becomes `verification_pending`.
- Existing verified operations replay without a second insert.
- Existing pending operations reconcile by marker before any other action.
- Errors and audit records never include provider bodies, tokens, event content,
  attendee addresses, or URLs.

## Verification

Focused RED/GREEN tests will cover the executor and adapter. Full TypeScript,
unit, contract, Worker, build, crypto-boundary, documentation, release
evidence, security, and diff checks must remain green. No provider or
deployment command runs in this increment.
