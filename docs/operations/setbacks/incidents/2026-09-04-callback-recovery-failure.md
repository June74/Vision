# SB-20260904-callback-recovery-failure: Live sign-in reaches synchronization recovery and fails

- **Status:** open; owner sign-in failed after the connected-lag repair deployment
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

## Recurrence after the connected-lag repair

The owner retried Google sign-in and again received only
`callback_authorization_recovery_failed`. Read-only GitHub verification confirms
run `33931354751` is the latest preview workflow run and succeeded for `b68f213`.
This proves the intended release workflow completed, not which Worker version
handled the owner's particular callback. Live sign-in remains unsuccessful.

The earlier database screenshot establishes unequal checkpoint versions, not
whether maintenance was older or newer. The existing category also combines
repository exceptions with a returned conflict. The reproduced older-snapshot
bug and its regression fix remain valid, but are not a complete diagnosis of
this recurring live failure. Next checks must distinguish those causes without
resetting secrets, modifying live rows, or weakening authentication guards.

The new ignored `auth-recovery-version-direction.sql` reports aggregate counts
for older/equal/newer maintenance snapshots and connected, unmarked checkpoints.
Five synthetic scenarios using actual migrations passed, including marked and
unmatched rows; all three version-direction cases ran in read-only transactions.
No external database request occurred. Documentation coverage and diff whitespace
checks passed. Existing Wrangler login and local database credentials are absent,
so the owner must execute this new counts-only query on the preview database.
No application code or deployment was changed during this recurrence check.

The owner returned the version-direction query: matched calendars 1, maintenance
older 1, equal 0, newer 0, connected and unmarked 1. This rejects the hypothesis
that an ahead-of-checkpoint maintenance snapshot explains the observed database
state. Those predicates meet the repaired lag alternative, but this separate
snapshot does not prove the exact callback token metadata, all other topology
guards, runtime database target, or successful query execution. The current
diagnostic and its Worker tests explicitly group repository throws and returned
conflicts under the same stage; more precise callback-boundary evidence is needed.

Proposed bounded next step before owner approval: reuse the existing diagnostic
and add one authored constant for an explicit recovery `conflict`. Preserve the
existing generic stage for execution failures, invalid outcomes, and unknown
causes. Do not alter the repository query, accepted outcomes, session ordering,
audit category, secret configuration, or live database records. Tests must prove
the new distinction, unchanged local/production failure bodies, no session/cookie
creation on either failure, and no raw error or credential disclosure. This
captures the actual callback boundary; another standalone SQL snapshot cannot
establish the exact token metadata present during that callback. Design approval
was requested before implementation or a new preview deployment.

## Approved diagnostic distinction: local verification

The owner approved implementing, testing, and deploying the diagnostic-only
change. The existing closed tuple now includes
`callback_authorization_recovery_conflict`, emitted by an inner `AuthStageError`
only after the port returns exactly `conflict`. The old generic stage remains for
execution exceptions and invalid outcomes. No repository, logger-schema
structure, authentication admission rule, or live database record was changed.

The baseline passed 23 authentication and 31 logging tests. Test-first expansion
failed exactly three expected conflict-category assertions with 42 passing.
The minimal five-line production diff then passed all 45 authentication tests,
32 logging tests, and both TypeScript configurations. The actual Worker response
body, headers, logs, token persistence, old session preservation, and lack of
new sessions/cookies are checked across all three environments, with explicit
invalid returns and error-shaped throws. Both accepted outcomes are covered in
each environment. Private fixture sentinels remain absent from actual outputs.

Full `pnpm check` passed: 1,927 unit/integration/security tests (6 existing skips),
199 contract tests, and 171 Worker tests. All 47 Chromium tests passed, for 2,344
passing tests total. Documentation coverage, build, release security scan,
preview configuration validation, and no-upload Wrangler dry run passed.
Browser tooling emitted only existing terminal-color warnings. Independent
review found no critical or important issues and approved the runtime change for
preview. Its minor note about historical approval/status wording is addressed
by this explicit current-status section. The exact preview deployment is the
remaining release gate; real owner sign-in still fails on the preceding
deployment and is not claimed fixed.

## Diagnostic-only preview release

- Application commit: `ed96c81d33f61f412708d3b4fe64ded8bc65351a`.
- GitHub run `33941790470`: admission succeeded in 14 seconds, candidate
  application/browser verification succeeded in 5 minutes 11 seconds, and normal
  preview deployment succeeded in 32 seconds for that exact Phase C commit.
- Worker version: `e1d87284-25b7-401e-bae2-903b090f9ebf`; deploy log timestamp
  2026-09-05T03:31:47Z (2026-09-04 local).
- Public root and health returned 200, health reported `ok`, and the signed-out
  session endpoint returned 401. No cookies, tokens, or credentials were sent.
- The clean Projects Phase C worktree was fast-forwarded to the release. Main,
  production, secrets, recovery SQL, and manual database state remain unchanged.
- Owner must begin one fresh sign-in from the preview root and return only the
  safe diagnostic category. The new conflict category proves an explicit port
  conflict; the existing generic category covers throws/invalid outcomes. Neither
  establishes a precise SQL predicate or database error. Real sign-in and Phase C
  live acceptance remain incomplete. Preserve the diagnostic until sign-in works.
