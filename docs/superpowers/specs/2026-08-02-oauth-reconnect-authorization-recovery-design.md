# OAuth Reconnect Authorization Recovery Design

**Status:** Owner-reviewed written specification

**2026-09-04 amendment:** The owner approved a no-mutation `not_needed` exception
for an already-connected, completely unmarked checkpoint with an older maintenance
snapshot. The [connected-checkpoint lag design](2026-09-04-connected-checkpoint-lag-design.md)
supersedes only the version-inconsistency classification for that case. The strict
disconnected authorization recovery requirements below remain unchanged.

**Phase:** B — authentication and synchronization live-acceptance prerequisite

**Execution:** Test-first implementation, independent review, exact preview
deployment, and privacy-safe live verification

## Goal

When a valid owner reconnect saves fresh Google credentials, Vision must recover
only the exact stale authorization-disconnected synchronization state created by
its calendar-maintenance scheduler. It must never clear an unrelated, newer,
consumer-owned, or ambiguously correlated failure.

This repair unblocks Phase B Task 8 live acceptance. It does not itself satisfy
the remaining normal-sync, missed-signal repair, authentication-lifecycle, AI,
cleanup, deployment-evidence, or handoff requirements.

## Confirmed deployed behavior

The live callback path is:

```text
GET /api/auth/google/callback
  -> consume one OAuth transaction
  -> exchange and validate the Google grant
  -> authorize the private owner identity
  -> save owner-bound encrypted Google tokens
  -> rotate any prior Vision session
  -> create a new Vision session
  -> redirect to the calendar desk
```

The deployed callback saves fresh credentials but does not reconcile calendar
authorization health. The diagnostics repository then truthfully reports the
unchanged checkpoint as disconnected, while webhook lookup and scheduled repair
both require a connected checkpoint. Waiting cannot recover the state.

Privacy-safe live reconciliation proved all of the following without returning
identities, credentials, provider identifiers, database values, or event data:

- owner, token, connected setup, canonical Vision calendar, checkpoint, and
  maintenance records align;
- the checkpoint is `disconnected` with error category `authorization`;
- the complete scheduler-owned credential-failure marker matches that current
  checkpoint; and
- the marker predates the newly persisted token row.

The token repository already returns authoritative `tokenVersion` and
`updatedAt` metadata from its atomic encrypted-token upsert. No token, schema,
or encryption redesign is required.

## Scope

The implementation changes only:

1. the OAuth callback dependency contract and callback ordering;
2. the owner-scoped channel-maintenance repository;
3. focused Worker, repository, concurrency, and contract tests; and
4. the minimum documentation required for the permanent behavior.

It adds no route, UI control, schedule, Queue, binding, environment variable,
secret, provider resource, database table, or migration. It does not read,
print, copy, or rotate any key. Backup key version remains `1`.

## Chosen architecture

### 1. Narrow authorization-recovery port

Add a dedicated port to `AuthRouteDependencies`, rather than exposing the
entire maintenance repository to authentication:

```ts
type AuthorizationRecoveryOutcome =
  | "recovered"
  | "not_needed"
  | "conflict";

interface AuthorizationRecoveryPort {
  recoverAfterReconnect(input: {
    readonly googleSubject: string;
    readonly tokenVersion: number;
    readonly tokenUpdatedAt: Date;
  }): Promise<AuthorizationRecoveryOutcome>;
}
```

The production dependency factory constructs one owner-scoped
`ChannelMaintenanceRepository` from the same database and derived private owner
used by the token repository. The callback receives only the narrow port.

The recovery input contains no access token, refresh token, email, calendar
identifier, provider identifier, session bearer, or encryption material.

### 2. Callback ordering

Capture the authoritative result already returned by `saveGoogleTokens()` and
insert recovery immediately after that write:

```text
token persistence
  -> guarded authorization recovery
  -> prior-session revocation
  -> new-session creation
```

Before calling the port, set the next safe callback failure category to:

```text
authorization_recovery_failed
```

Outcomes behave as follows:

- `recovered`: continue normal session rotation and creation;
- `not_needed`: continue normal session rotation and creation;
- `conflict`: fail the callback safely before rotating or creating a session;
- thrown repository error: fail under the same safe category.

No raw error text reaches the response or operational log.

If token persistence succeeds but recovery fails, the valid encrypted token row
remains and no new session is created. A fresh OAuth attempt can retry safely.
If recovery succeeds but later session work fails, leaving the checkpoint
connected remains truthful because the fresh owner-bound credential is already
durable.

### 3. One atomic owner-scoped transition

Add one repository operation that classifies and, when eligible, updates state
in a single SQL statement. The repository remains permanently bound to one
owner; callers cannot supply an owner identifier.

The statement locks and evaluates the authoritative rows in a stable order:

1. the owner/subject token row;
2. connected calendar setup and canonical owner Vision connection;
3. the current Google Calendar checkpoint; and
4. its matching maintenance row.

Recovery is eligible only when every condition below is true in the same
statement:

- the token row still matches the callback's exact subject, token version, and
  update time;
- setup is `connected` and its subject matches the token and connection;
- the connection is the canonical owner-controlled `Vision` calendar;
- maintenance connection version equals the current setup version;
- maintenance checkpoint version equals the current checkpoint version;
- checkpoint status is exactly `disconnected`;
- checkpoint error category is exactly `authorization`;
- marker checkpoint version equals the current checkpoint version;
- marker category is exactly `authorization`;
- marker recorded time equals checkpoint update time; and
- marker recorded time is strictly earlier than the persisted token update
  time.

When eligible, the same statement:

- changes checkpoint status to `connected`;
- clears checkpoint error category;
- clears all three credential-failure marker fields; and
- advances the checkpoint update time to the persisted token update time and
  advances maintenance update time to the greater of its current value and the
  persisted token update time, so a concurrent maintenance timestamp can never
  move backward.

It must preserve:

- checkpoint identifier, sync-token ciphertext, key version, committed time,
  and checkpoint version;
- calendar setup and connection rows;
- active and historical channels;
- sync and repair jobs;
- renewal generation, leases, failure counters, and cleanup state; and
- every event, category, graph, AI, backup, session, and audit row.

### 4. Closed outcome classification

The statement returns exactly one closed outcome:

#### `recovered`

The complete eligible tuple was locked and updated.

#### `not_needed`

No recovery is required when the exact token row still wins and one of these
conditions is true:

- calendar setup does not yet exist or is not yet connected, as in initial
  authentication before calendar setup;
- the current canonical checkpoint is already connected and has no stale
  marker; or
- the checkpoint has a state or category other than the exact
  `disconnected / authorization` target and is left untouched.

An already-completed identical recovery may also return `not_needed` when the
same authoritative token row still wins.

#### `conflict`

Fail closed when:

- the token version or update time no longer matches because another token
  write won;
- connected setup exists but its canonical connection, checkpoint, or
  maintenance topology is missing or version-inconsistent;
- an otherwise connected checkpoint still carries any credential-failure
  marker;
- the target checkpoint is `disconnected / authorization` but any marker field
  is absent or mismatched;
- the marker is simultaneous with or newer than the token write; or
- a concurrent writer changes any guarded row before the transition commits.

This distinction keeps ordinary first login and unrelated checkpoint health
from being blocked while refusing to erase ambiguous authorization failures.

## Why the complete marker is mandatory

The scheduler writes checkpoint disposition and all three maintenance marker
fields together. The marker therefore proves scheduler ownership only when its
checkpoint version, category, and recorded time exactly match the current
checkpoint.

The Queue consumer has a separate claim-guarded failure path that can write a
checkpoint authorization failure without writing the scheduler marker.
Clearing every `disconnected / authorization` checkpoint would erase that newer
consumer-owned evidence. The callback must not infer ownership from status and
category alone.

The existing `clearCredentialRetry()` method is not broadened. It remains for
its current transient/database retry semantics. Reconnect recovery receives a
separate method because it has different eligible status, category, token-order,
and callback-result requirements.

## Concurrency behavior

### Two OAuth callbacks

Each callback uses the token metadata returned by its own durable write. If a
newer callback updates the token row first, an older callback's exact metadata
no longer matches and it returns `conflict`. The current callback may recover.

If both callbacks legitimately observe the same authoritative metadata, row
locking allows at most one marker-clearing update. A follower sees the already
connected, unmarked state and returns `not_needed`.

### Scheduler or Queue writer racing recovery

The checkpoint and maintenance locks prevent a partial clear. If another writer
wins first, timestamp/version/marker comparison fails and recovery returns
`conflict` or `not_needed` without changing that writer's state. If recovery
wins first, a later valid writer may record a new failure normally; reconnect
does not suppress future failures.

No in-memory mutex, process-local flag, or read-then-write application sequence
is accepted as a substitute for the database transition.

## Failure and privacy handling

- The callback response remains the existing generic authentication-failure
  page.
- The only new log value is the fixed category
  `authorization_recovery_failed` for `action: auth.callback`.
- No database exception text, SQL text, identity, subject, email, token metadata,
  row value, provider value, request query, or session value is logged.
- A conflict never triggers a manual SQL repair or automatic broad reset.
- Recovery never calls Google, edits a calendar, changes OAuth scopes, or
  revokes provider access.
- A failed or uncertain deployment rolls back to the previous reviewed normal
  artifact and leaves the incident contained for diagnosis.

## Test-first implementation

### Worker callback tests

Add RED tests proving:

1. recovery runs after token persistence and before any old-session revocation
   or new-session creation;
2. the port receives only subject plus authoritative token version/update time;
3. `recovered` and `not_needed` both complete the existing secure callback;
4. `conflict` and thrown recovery failures produce only
   `authorization_recovery_failed`, create no session, and do not rotate an old
   session;
5. the encrypted token write remains durable when recovery fails;
6. first login with no calendar setup succeeds through `not_needed`;
7. callback response, cookie, and safe logger never contain token, subject,
   email, marker, database, or exception values; and
8. all existing transaction, claim, scope, rotation, and replay behavior remains
   unchanged.

### Repository adversarial tests

Extend the database-backed channel-maintenance suite to prove:

1. the exact live-shaped scheduler marker recovers once;
2. all three marker fields clear together;
3. cursor ciphertext, checkpoint version, setup, connection, channels, jobs,
   renewal fields, and counters are preserved;
4. initial/no-setup and already-connected states return `not_needed`;
5. unmarked authorization failure, marker/category/time mismatch, subject
   mismatch, setup/checkpoint version mismatch, token version mismatch, token
   update-time mismatch, and marker-at/after-token ordering return `conflict`;
6. non-authorization and non-target checkpoint states remain untouched;
7. repeated recovery is idempotent; and
8. cross-owner rows cannot be observed or changed.

### Real PostgreSQL interleaving tests

Add an opt-in multi-session PostgreSQL test using the repository's actual SQL,
observable database locks, and an explicitly approved disposable test database.
It must never use preview owner data. The test must prove:

1. an older callback cannot clear state after a newer token write wins;
2. a scheduler/Queue failure that wins before recovery is preserved;
3. a new failure written after successful recovery remains visible; and
4. concurrent callbacks cannot partially clear checkpoint and marker state.

Mock-only or single-connection tests are insufficient for these claims.

### Verification gates

After targeted GREEN tests, run:

- focused Worker authentication tests;
- focused PGlite/database adversarial tests;
- the approved real-PostgreSQL interleaving test;
- TypeScript checks;
- unit/integration, contract, and Worker suites;
- documentation coverage;
- production build and preview validation;
- release security and privacy checks; and
- diff and exact-staged-path checks.

Obtain independent review with zero Critical and zero Important findings before
deployment.

## Preview deployment and live acceptance

Deploy only the exact reviewed and pushed repair commit with the existing normal
preview variables. Do not add or change secrets. Do not rotate the backup key.

Before asking the owner to test, Codex verifies all non-credential parts of the
deployed flow. If Google requires account choice or consent, only the owner
interacts with those controls; automation never reads account text,
authorization values, or callback data.

A fresh reconnect passes only when privacy-safe evidence proves:

- no access-denied or authentication-failure page;
- authenticated Vision session;
- connected calendar setup;
- connected authorization/foundation health;
- fresh authenticated diagnostics and calendar reads;
- exactly the two permanent schedules;
- no temporary binding; and
- the stale scheduler marker is absent.

Capture only closed categories, booleans, bounded counts, and UTC timestamps.
Do not capture URLs, account data, event content, tokens, rows, provider
identifiers, correlation handles, object keys, or raw logs.

On success, close the reconnect incident and resume the authoritative Task 8
sequence from Step 1. On failure, diagnose the newest safe callback category or
closed health state before changing code again.

## Alternatives rejected

### Manual database repair

A one-time reset would make the current row look healthy without preventing the
next reconnect from reproducing the defect. It also bypasses normal application
invariants and cannot provide a regression test.

### Teach scheduled repair to recover every disconnected authorization row

The current scheduler intentionally excludes disconnected checkpoints, and a
broad scheduled reset cannot prove that fresh credentials correspond to the
failure being cleared. It would also delay recovery and erase ownership
distinctions between scheduler and Queue writers.

### Clear every disconnected authorization checkpoint in the callback

Status and category do not prove writer ownership. This would erase newer or
consumer-owned failures and is therefore unsafe.

### Combine token persistence and all sync recovery in one cross-repository
transaction

This would couple encryption, token storage, session authentication, calendar
topology, and maintenance SQL into a much larger change. The exact persisted
token metadata already supplies a safe compare-and-swap boundary, so the larger
transaction is unnecessary.

## Acceptance criteria

This design is complete when:

1. the written specification is owner-reviewed;
2. a detailed implementation plan is approved through the normal workflow;
3. RED tests fail for the intended missing behavior;
4. the guarded transition and callback wiring pass all targeted and full gates;
5. independent review reports zero Critical and zero Important findings;
6. the exact reviewed commit is pushed and deployed to preview;
7. fresh live reconnect proves connected health without private-data exposure;
8. the incident record is closed with privacy-safe evidence; and
9. Phase B Task 8 resumes without manual database mutation or key rotation.
