# SB-20260904-callback-recovery-failure: Live sign-in reaches synchronization recovery and fails

- **Status:** contained; repair deployed, owner sign-in confirmation pending
- **First/last observed:** 2026-09-04
- **Phase/task:** Phase C private-pilot sign-in acceptance
- **Environment/version:** Preview application e980307; deployment run 33927962462

## Symptom and impact

After the deployment fix, the owner completed Google's prompts and reported only the safe
category `callback_authorization_recovery_failed`. Vision did not issue a session.
Google exchange, scope/identity checks, encrypted token persistence, and token readback precede
this stage; the remaining failure is in the recovery call or its closed outcome check.

## Evidence, reproduction, and attempts

The exact production call is `recoverAuthorizationAfterReconnect` in the channel-maintenance
repository. It locks five owner-scoped tables and returns recovered, not_needed, or conflict.
No current database connection or Cloudflare API credential is available locally.
A read-only SQL query reporting permissions, missing marker columns, and aggregate row counts
was validated on in-memory PostgreSQL fixtures: ready schema, revoked update, and missing column.
No live database mutation, credential reset, or recovery bypass was attempted.

The owner supplied the metadata/count result: all five `vision_app` SELECT/UPDATE
checks passed, no required marker columns were missing, and connected setups,
connections, checkpoints, and maintenance each had one row. The SQL editor ran
as the owner role, but the permission checks explicitly targeted `vision_app`.
This excludes those schema/grant deficiencies on the inspected database; counts
alone do not establish matching owners, Google identities, calendars, versions,
or exact authorization markers, or prove that the Worker uses this database.

The second live screenshot contains one token record. Identity, canonical
calendar, setup-version, and row-relationship checks pass. The checkpoint is
connected and the maintenance credential marker is absent. The failed topology
requirement is `maintenance_matches_checkpoint_version`. False marker comparisons
are expected when the marker is absent; token timestamps also pass the
whole-millisecond check. This snapshot would be classified as a conflict by the
recovery SQL despite there being no authorization failure to recover.

Confirmed live code paths:

- Worker OAuth route -> token persistence -> narrow recovery port ->
  `recoverAuthorizationAfterReconnect` -> conflict prevents session creation.
- Queue consumer -> `syncCalendar` -> sync repository checkpoint commit advances
  the checkpoint version without updating maintenance's checkpoint snapshot.
- Scheduled repair -> `bootstrapConnectedCalendars` refreshes that snapshot
  separately when eligible.

A network-disabled local reproduction used the real repositories and actual
migrations with synthetic rows, a synthetic provider, and a generated test key.
Before sync, recovery returned `not_needed`; after a successful empty sync it
returned `conflict` with the checkpoint still connected and unmarked. Existing
maintenance bootstrap restored `not_needed`; another normal sync reproduced
`conflict`. No manual version manipulation was needed to reproduce the defect.

## Cause classification

- **Confirmed:** The live snapshot has a maintenance/checkpoint version mismatch. Normal sync reproduces that mismatch and recovery conflict locally because authentication requires equality between asynchronously updated versions.
- **Remaining uncertainty:** No direct live repository trace proves there is no additional runtime query failure. The snapshot does not record the exact failed callback's concurrent token writes.
- **Rejected hypotheses:** The inspected database is not missing the three marker columns or the five tested table-level SELECT/UPDATE grants. No evidence supports changing Google redirect/client secrets for this stage.
- **Known exclusions:** The preview build/upload failure is separately fixed and verified.

## Correction, prevention, and next step

Owner-approved narrow design (2026-09-04), implemented locally: classify an already-connected,
unmarked canonical checkpoint as `not_needed` when its maintenance checkpoint
snapshot is older. Preserve exact token metadata, owner/subject/calendar/setup
checks; missing or ahead-of-checkpoint maintenance and any connected marker
still conflict. Actual disconnected authorization recovery retains all existing
exact version/marker/timestamp guards. Do not mutate synchronization rows in this
no-recovery branch. The prior spec's version-inconsistency rule is amended only
for this case in the approved connected-checkpoint lag design.

Alternative: synchronize the maintenance snapshot within every sync commit. That
touches broader synchronization/renewal locking and must account for active leases;
it is not preferred for this bounded sign-in repair. A one-time manual database
reset is not durable, as the next normal sync reproduced the mismatch locally.
Owner: Codex and project owner. Live sign-in and Phase C acceptance remain incomplete.

## Verification

Initial diagnostic SQL passed three local fixture checks; live metadata/count
results are recorded above. The second query passed 16 synthetic PostgreSQL
scenarios using the actual migrations, including empty state, missing setup,
valid recovery relationships, mismatched identity/calendar/version/markers,
timestamp precision, and connected marked/unmarked states. A read-only transaction
accepted the query; before/after comparisons found no changed rows. Its output
contains only counts and booleans. Live relationship results are recorded above.
The four-stage real-repository reproduction passed all expected outcome checks
with zero network attempts. Actual successful Google sign-in remains pending.

Test-first implementation: the original focused baseline passed 55 tests. New
tests failed twice with the intended `conflict` versus `not_needed` difference;
the SQL contract separately rejected the missing guarded alternative. After the
minimal join change, 92 focused database/contract tests passed. Added tests cover
two actual sync commits, repeated no-op recovery, full row preservation, active
renewal metadata, equal/older/ahead versions, identity/token/calendar/setup guards,
missing rows, markers, and non-connected states.

Full local checks passed: 1,926 unit/integration/security tests, 199 contract
tests, 149 Worker tests, and 47 browser tests (2,321 total passing; 6 skipped).
Both TypeScript checks, documentation coverage, build, release security scan,
generated preview configuration validation, and no-upload Wrangler dry run passed.
The opt-in PostgreSQL multi-session fixture is not configured, so no live
interleaving evidence is claimed. Independent review found no critical or
important issues and approved the existing changes for preview. It confirmed
unchanged SQL locking dependencies without claiming newly proven concurrency.
Preview deployment completed; owner acceptance remains pending.

## Preview release evidence

- Reviewed application commit: `b68f2139c298ca43ca35c36df1419ba9822c0253`.
- GitHub preview run: `33931354751`; admission, candidate verification, and normal
  deployment all succeeded for that exact Phase C commit. Deployment completed
  on 2026-09-05 UTC (2026-09-04 in the owner's local timezone).
- Worker version: `c615956e-5b69-4a96-aeab-33f972d10296`.
- Live public checks: root 200, health 200 with `ok`, unauthenticated session 401,
  and sign-in start 302 to Google's origin. Redirect query/cookie values were
  neither printed nor followed.
- The isolated browser tab opened the Vision bootstrapping shell. Follow-up tab
  lookup using retained IDs failed to resolve that temporary tab; its original
  handle closed it successfully. No completed browser sign-in or authenticated
  UI acceptance is claimed from that partial browser probe. This does not
  invalidate the separate successful HTTP entry checks.
- An additional synthetic database probe installed row-write rejection triggers
  on all five recovery tables. Two `not_needed` calls passed; an explicit
  identical-value UPDATE was rejected by the trigger. This is ad hoc additional
  no-write evidence, not a new committed trigger regression or concurrency test.
- Main, production, secrets, and live database records were not manually changed.
  The existing diagnostic remains pending successful owner sign-in.
