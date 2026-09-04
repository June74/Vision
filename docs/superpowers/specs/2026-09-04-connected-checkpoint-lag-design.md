# Connected checkpoint lag during sign-in

Status: owner approved the narrowly scoped rule, regression tests, review, and preview deployment on 2026-09-04.

Hardline: **no more than 20 agents at once**. Use one implementation coordinator and one independent reviewer for this repair.

## Evidence and scope

Normal synchronization advances `sync_checkpoints.version` independently of the
maintenance snapshot. A four-stage real-repository reproduction alternated
`not_needed`, `conflict`, `not_needed`, `conflict` across bootstrap, sync,
maintenance refresh, and another sync. The preview snapshot showed a connected,
unmarked checkpoint with unequal checkpoint versions and otherwise matching
identity/calendar/setup relationships. Its direction was not captured.

Confirmed path: Worker OAuth callback -> exact persisted token metadata ->
owner-scoped recovery repository -> outcome gate -> session creation.

## Approved rule amendment

This supersedes only the checkpoint-version inconsistency rule in the
2026-08-02 reconnect design for an already-connected, completely unmarked
checkpoint whose maintenance checkpoint version is strictly older.

The existing exact token (owner, subject, version, timestamp), connected setup,
matching Google identity, canonical owned Vision calendar, checkpoint identity,
maintenance identity, and exact setup version checks remain mandatory.

The maintenance/checkpoint join admits either:

1. equal checkpoint versions, retaining every existing classification; or
2. a strictly older maintenance checkpoint version, checkpoint status `connected`,
   and all three maintenance credential marker fields null.

Case 2 returns `not_needed` and changes no rows. It does not update maintenance,
clear errors, recover a disconnected checkpoint, or affect renewal leases.
Missing rows, wrong identities/calendars/setup versions, newer maintenance,
any marker, and non-connected states do not qualify for this exception.
Actual `disconnected / authorization` recovery retains exact checkpoint versions,
complete marker matching, strictly newer token time, locking, and atomicity checks.

No route, schema, secret, dependency, schedule, or provider permission changes.
Existing preview-only closed diagnostic categories remain until live sign-in is
confirmed. No free-form logging or callback/token/identity output is introduced.

## Verification and release

First reproduce the bug in a failing automated test through actual sync commits.
Add equality/older/newer, marker, identity, token, missing-row, status, preservation,
and repeated-call cases. Keep existing disconnected recovery and callback tests.
Run focused suites, the full local checks and browser suite, independent review,
generated preview configuration checks, and GitHub preview verification/deploy.

The optional multi-session PostgreSQL suite needs its separately configured
disposable fixture; never use preview owner rows as test data. Report a skipped
concurrency suite explicitly and do not claim new live interleaving evidence.

Push only the reviewed Phase C ref. Main and production stay unchanged. Verify
live health/session/start behavior without following or recording OAuth query
values. The owner completes Google prompts and confirms an authenticated Vision
session. Deployment and local tests alone do not complete live acceptance.
