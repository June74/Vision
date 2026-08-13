# Phase C handoff

Phase B is complete and live-accepted. This handoff is the privacy-safe
boundary between the trusted read-only foundation and Phase C design review.
It contains no provider identifiers, account details, secret values, raw logs,
private event data, authorization codes, tokens, database URLs, or encryption
keys.

## Phase B completion state

- Status: complete and live-accepted.
- Accepted application commit: `5ec2887392d935751b591cc36248101b58071ee1`.
- Acceptance-closure documentation commit: `0a1454144e55ffa3b303fcac9e4d2835a2ba6535`.
- Accepted evidence: [Phase B completion evidence](phase-b-evidence.md), the
  [maintenance-observer closure record](setbacks/incidents/2026-08-12T141750Z-generic-consumer-repeat.md),
  the [normal-deployment closure record](setbacks/incidents/2026-08-12T202208Z-normal-deploy-baseline-closure-failure.md),
  and the [tracked setback index](setbacks/INDEX.md).
- Final verification included application, contract, Worker, workflow,
  TypeScript, documentation, production-build, browser, normal-deployment,
  maintenance-observer, and live-health checks. No event-level Google create,
  update, move, cancel, or delete behavior is enabled by Phase B.

## Retained permanent surfaces

- Approved-account authentication, secure sessions, encrypted token storage,
  and owner-scoped authorization.
- The single secondary Google calendar named `Vision`, with school, work, and
  personal categories represented inside Vision.
- Initial, push-triggered, incremental, scheduled-repair, renewal, queue,
  lease, and projection-rebuild synchronization.
- Provider-neutral event storage, PostgreSQL node-and-edge authority,
  application encryption, privacy-safe audit, operational status, encrypted
  backups, restore controls, and the enforced AI budget.
- The Phase B design remains authoritative:
  [2026-07-22 Phase B data-foundation design](../superpowers/specs/2026-07-22-phase-b-data-foundation-design.md).

## Phase C entry decision

- Decision: proceed to Phase C design review; do not begin application
  implementation from this handoff.
- Approved boundary: build the authenticated, approval-based, verified
  calendar-event write pipeline while preserving Phase B read-sync and
  recovery behavior.
- Core write contract:
  1. Build a proposed change from an authenticated request.
  2. Retrieve the latest Google event and version.
  3. Apply deterministic permission, privacy, conflict, recurrence, and hard-
     constraint checks.
  4. Show the exact before-and-after preview, attendee impact, recurrence
     scope, and notification behavior.
  5. Require explicit user confirmation.
  6. Revalidate the Google version immediately before writing.
  7. Invalidate approval when material state changed.
  8. Execute one idempotent write and reconcile lost responses before retrying.
  9. Retrieve the resulting Google state and record the verified result and
     audit event.
  10. Show `Verification pending` for an unknown outcome and never claim
      success without verified provider state.
- Cross-cutting requirements: every operation has an opaque operation ID;
  creates use private Google extended properties for idempotency; recurring
  events require explicit occurrence-versus-series scope; connected-calendar
  actions remain confirmation-based in Version 1; AI may interpret and
  explain but cannot grant permission or perform the write; every accepted
  change has audit history and an undo or compensating path.
- Open risks for the design review: the exact first write operation, the
  provider-neutral approval/operation state model, one-operation retry and
  reconciliation boundaries, recurrence and attendee semantics, and the
  live acceptance fixture/cleanup contract.

## Phase C product scope to divide into increments

Phase C also begins the secretary MVP. It must be divided into acceptance-
backed increments rather than implemented as one batch:

1. Write-pipeline contracts and deterministic approval state machine, with no
   provider mutation.
2. One-off event creation through preview, confirmation, version check,
   idempotent write, verified read-back, audit, and compensating undo.
3. One-off event update, move, cancel, and delete through the same shared
   pipeline, each with its own conflict and live acceptance cases.
4. Recurring-event scope plus attendee and notification behavior, with
   occurrence-versus-series previews and stale-state invalidation.
5. Conversational capture, Today view, tasks, and notes as independently
   useful read/write Vision-local flows that do not silently authorize a
   connected-calendar change.
6. Scheduling proposals and conflict handling, followed by template-backed
   briefings and follow-ups; AI remains optional and policy-gated.

Each increment requires focused tests, the relevant provider contract and
database-boundary tests, browser-path coverage where user confirmation is
involved, and a fresh live-preview acceptance before the next connected write
surface is enabled.
