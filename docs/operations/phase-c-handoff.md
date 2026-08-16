# Phase C handoff

Phase B is complete and live-accepted. This handoff is the privacy-safe
boundary between the trusted read-only foundation and the locally verified
Phase C write surface. Live connected-write acceptance remains a separate gate.
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

- Decision: proceed with Phase C in acceptance-backed increments. The first
  three local implementation increments are now implemented from this handoff;
  live connected-write acceptance remains pending.
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
- Remaining risks for the next acceptance gate: live disposable-fixture
  cleanup, provider-side evidence, deployment admission, and production
  database migration review. Recurrence, attendees, and notification semantics
  remain explicitly out of this one-off increment.

## Phase C increment 1 — provider-neutral write contract

Increment 1 is implemented and locally verified on the Phase C branch. The
design is recorded in
[the write-pipeline contract design](../superpowers/specs/2026-08-16-phase-c-write-pipeline-contracts-design.md),
and the implementation is `src/domain/calendar-write/approval.ts` with
focused tests and mirrored simple/technical references.

It now provides:

- strict one-off create proposal validation;
- an immutable exact before/after preview with attendee, recurrence, and
  notification effects represented explicitly;
- stable rejection codes for unsupported effects and invalid input;
- exact target-calendar version approval and stale-state invalidation; and
- pure `proposed` → `confirmed` → `writing` → verified, pending, or failed
  transitions.

This increment intentionally does not register an HTTP route, persist an
operation, call Google Calendar, create an event, or enable a browser write
control. The next increment consumes this contract for one-off event creation
through provider idempotency, read-back, audit, and compensating undo.

## Phase C increment 2 — verified one-off create execution

Increment 2 is implemented and locally verified on the Phase C branch. Its
design is recorded in
[the one-off create execution design](../superpowers/specs/2026-08-16-phase-c-one-off-create-execution-design.md)
and its execution plan is recorded in
[the one-off create execution plan](../superpowers/plans/2026-08-16-phase-c-one-off-create-execution.md).

It now provides:

- a provider-neutral executor that starts only from a confirmed proposal;
- immediate target-calendar version revalidation and stale invalidation;
- owner-scoped idempotency and exactly-one create behavior;
- private operation-marker reconciliation after an uncertain provider result;
- exact provider read-back before reporting `verified`;
- privacy-safe create and undo audit facts with distinct lifecycle identities;
- a compensating delete that reports `undone` only after provider absence; and
- a bounded Google adapter for calendar-version reads, one-off insert, marker
  lookup, read-back, and version-guarded delete.

The provider adapter accepts Google-shaped calendar identifiers and quoted ETags
while rejecting control characters before URL or header use. Focused executor,
approval, and adapter tests plus both TypeScript boundaries are green. This
increment intentionally does not register an HTTP route, compose a durable
ledger implementation, add a browser confirmation control, call a live Google
account, deploy, or enable user-facing connected writes. The next increment
must wire those boundaries and earn fresh browser and live-preview acceptance.

## Phase C increment 3 — authenticated local one-off write surface

Increment 3 is implemented and locally verified on the Phase C branch. Its
design and implementation plan are recorded in
[the authenticated one-off write surface design](../superpowers/specs/2026-08-16-phase-c-authenticated-one-off-write-surface-design.md)
and [implementation plan](../superpowers/plans/2026-08-16-phase-c-authenticated-one-off-write-surface.md).

It now provides:

- additive encrypted approval and durable execution tables with owner scope;
- a Drizzle/Neon repository that encrypts proposal content, uses the
  `proposal_domain` key partition, and fails closed on malformed rows;
- authenticated preview, status, confirm, and undo routes with authentication
  before body parsing, CSRF on every mutation, server-derived authority, and
  no-store responses;
- exact-one durable claim, uncertain-create pending state, verified read-back,
  and verified compensating undo through the existing provider-neutral executor;
- a browser one-off composer with immutable preview, deliberate confirmation,
  truthful pending status, opaque-only reload recovery, and verified undo; and
- a narrow release-scan allowlist for the Phase C route module.

Local evidence includes focused schema, repository, Worker-route, browser,
security-surface, adapter, TypeScript, and documentation checks. The existing
Wrangler linked-worktree filesystem warning may appear in Worker output while
assertions pass; it is recorded as an environment-only contained warning.

This increment is not live acceptance. It has made no live Google create or
delete call, no deployment, no push, and no production database migration.
Live acceptance must use an explicitly approved disposable/private-pilot
fixture and prove preview, one confirmed create, exact read-back, replay safety,
verified undo, absence, and privacy-safe logs/audit before release.

## Phase C agent-concurrency hardline

**No more than 20 agents at once. This is a hard line.** The implementation run
uses 0 active agents and does not dispatch parallel implementation agents.

## Phase C product scope to divide into increments

Phase C also begins the secretary MVP. It must be divided into acceptance-
backed increments rather than implemented as one batch:

1. Write-pipeline contracts and deterministic approval state machine, with no
   provider mutation.
2. One-off event creation through preview, confirmation, version check,
   idempotent write, verified read-back, audit, and compensating undo. The
   backend core, bounded Google adapter, server composition, durable ledger,
   and browser loop are locally implemented; live acceptance remains next.
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
