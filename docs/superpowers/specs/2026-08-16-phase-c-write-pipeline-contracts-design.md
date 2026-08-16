# Phase C write-pipeline contracts design

## Decision

Implement the first Phase C increment as a provider-neutral domain contract
and deterministic approval state machine. This increment defines the exact
shape of a proposed calendar change, its user-visible preview, the safety
checks that may approve it, and the allowed lifecycle transitions. It does
not register an HTTP route, call Google Calendar, persist an operation, or
expose an event-write control.

The next increment will consume these contracts for one-off event creation.
Keeping the contract independently testable gives that provider-facing change
a fixed boundary for preview, confirmation, stale-state invalidation,
idempotency, read-back, audit, and undo.

## Why this boundary

Phase B is the trusted read-only foundation. Its live path is:

`App` → `readFoundationSnapshot()` → `GET /api/calendar/events` and
`GET /api/diagnostics/status`.

`worker.ts` currently registers no event-write route. The first Phase C module
therefore belongs in the domain layer and must be reachable by tests without
changing the accepted Phase B browser or provider path.

## Contract shape

The new domain module will define:

- `CalendarWriteAction`, initially only `create`;
- `CalendarWriteStatus` for `proposed`, `confirmed`, `invalidated`,
  `writing`, `verification_pending`, `verified`, and `failed`;
- a one-off event change with explicit title, description, start, end, time
  zone, category, privacy, attendee preview, recurrence preview, and
  notification preview;
- a `CalendarWriteProposal` containing an opaque operation ID, owner scope,
  target calendar scope, the base calendar version used for approval, and the
  exact before/after preview;
- closed reason codes for invalid input, unsupported recurrence, unsupported
  attendees, stale provider state, missing confirmation, and illegal state
  transitions;
- pure functions to create a proposal, evaluate deterministic approval, move
  the operation through an allowed transition, and invalidate approval when a
  material target snapshot changes.

The proposal is immutable after creation. The preview is derived once and
contains `before: null` for a create action, `after` with all fields that the
future provider adapter must write, `recurrence: "one-off"`, an attendee
count/list projection, and `notifications: "none"`. Unsupported future
fields are rejected rather than silently omitted.

## Deterministic rules

1. The operation ID, owner ID, target calendar ID, and base calendar version
   are opaque bounded identifiers; the domain module does not derive or
   reinterpret them.
2. The event title is required and bounded. Description is nullable and
   bounded. Start and end must be valid offset timestamps, and end must be
   strictly after start.
3. The time zone is required and bounded. The proposal must use one explicit
   category (`school`, `work`, or `personal`) and one explicit privacy level
   (`planning`, `private`, or `restricted`).
4. The first increment accepts no attendees and no recurrence rule. It still
   represents both facts in the preview so the next increment cannot hide
   their effect. Non-empty attendees or any recurrence input is rejected with
   a stable reason code.
5. Notifications are explicit and fixed to `none` in this increment. A
   caller cannot request a provider notification policy that the contract does
   not yet implement.
6. A proposal can be approved only from `proposed`, and only when the supplied
   target calendar version exactly equals the proposal's base version.
7. A confirmed proposal can move to `writing`, then to `verified`,
   `verification_pending`, or `failed`. A material target-version change
   invalidates a proposal before provider mutation. No transition function
   performs I/O or grants permission by itself.
8. AI output is not an approval input. Any later AI interpretation must produce
   the same explicit user proposal before this contract can approve it.

## State model

```text
proposed ──approve──> confirmed ──beginWrite──> writing
   │                      │                      │
   └──invalidate──────────┴──invalidate──────────┼──> invalidated
                                                  ├──> verified
                                                  ├──> verification_pending
                                                  └──> failed
```

The state machine returns a new frozen value and never mutates its input.
Provider reconciliation and undo are deliberately not represented as
successful behavior in this increment; they will be added with the one-off
create adapter and its acceptance tests.

## Testing and acceptance

Tests will cover valid one-off proposal construction, every deterministic
rejection, exact preview contents, stale-version invalidation, legal and
illegal transitions, immutability, hostile object shapes, and the invariant
that the module has no Google/provider imports. The existing Phase B read path
and full local checks must remain green. No live provider request is part of
this increment.

