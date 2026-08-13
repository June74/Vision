# Phase B Progress — Simple Guide

This page explains Phase B progress in concise, plain language. It is updated after each reviewed task.

## Current accepted milestone — 2026-08-12

Phase B is complete and live-accepted. The final normal preview deployment,
calendar-maintenance observer, and live health check passed, and the accepted
runtime remains on the Phase B branch.

The authoritative gate-by-gate status is [Phase B completion evidence](phase-b-evidence.md).
The [Phase C handoff](phase-c-handoff.md) is now the next design boundary.
Phase C application implementation has not started, and Phase B still does
not expose event-level Google create, update, move, cancel, or delete controls.

## Historical pre-closure checkpoint (superseded)

When a newly authorized monitored run is started, open the Cloudflare dashboard
for the `vision-preview` Worker, choose **Settings → Triggers → Cron Triggers**,
and confirm that the two normal plan-listed schedules are present and unchanged.
Do not edit the schedules or send challenge contents. Reply only
`baseline schedules confirmed` so the controller can receive fresh, nonce-bound
evidence within its wait window.

As of 2026-08-06, the full local `pnpm check` passes, the privacy-safe
candidate classifier and direct launcher contracts pass, and no live provider
mutation was performed during the latest repair. The remaining live work is
tracked there rather than inferred from local tests.

The one attempted classifier-enabled live launch was rejected by the execution
boundary before the controller process started. It changed nothing; a new exact
owner approval is required before the single monitored attempt can be retried.

On 2026-08-07, the repaired controller received valid baseline evidence and
attempted the newly authorized candidate run. The candidate failed closed with
a safe resource-missing category, and rollback was not verified. A second
freshly authorized run after the owner confirmed deployment access reproduced
the same result. Read-only deployment/version checks found no candidate or
rollback marker, and the live preview health contract stayed healthy. No
further mutation is allowed until the provider deploy capability/resource cause
is reconciled and a new exact approval is given.

### Next live-run prerequisite

The next action is not a manual deployment. First reconcile the saved Wrangler
deploy capability and the preview Worker's provider activity in read-only mode.
Do not change tokens, secrets, keys, bindings, schedules, or buckets while that
diagnosis is open.

For that check, open the Cloudflare account's API-token or member-access view
and confirm that the identity used by Wrangler has Worker deployment edit access
for `vision-preview` and access to the existing preview R2 bucket and Queue.
Inspect only; do not create, rotate, or paste a token. If the access is already
present, record that fact and return to the controller diagnosis. If it is
missing, stop and request approval before changing permissions.

The owner has confirmed deployment access, but a bounded read-only Wrangler
identity check does not mention R2. That metadata is not proof of missing R2
permission, so the next action is a read-only inspection of R2 access for the
same signed-in Wrangler identity and the preview Worker's provider activity.
No token, secret, key, binding, schedule, or bucket change is requested. Any
future mutation still needs a fresh, exact approval.

If that read-only access check is already satisfied, inspect the Worker in the
Cloudflare dashboard under **Settings → Bindings** and **Deployments/Activity**.
Confirm that the existing R2 and Queue bindings are attached and whether a
failed deployment entry exists for the latest attempt. Do not edit anything and
do not send identifiers; report only a generic result such as “bindings
attached,” “failed entry shown,” or “no failed deployment entry.”

The owner has clarified that both the preview R2 bucket and Queue exist. The
earlier generic “binding missing” report therefore does not confirm a binding
mismatch. No repair is authorized; the remaining investigation is a read-only
comparison of the exact Worker environment, binding attachment, and provider
activity.

The owner also confirmed that Deployments/Activity shows no failed entry. That
means Cloudflare rejected the request before creating a version record. The
next check is the Wrangler account/context and Worker version capability, not a
resource edit.

The local identity probe cannot display permission names, so it cannot prove or
disprove the required Worker Scripts Write access. Inspect the same Cloudflare
member role read-only; do not create or rotate an API token.

The owner confirms that identity has all privileges, so a simple role shortage
is now unlikely. The next read-only check is the existing deployed-version
shape and exact account/Worker context.

The candidate artifact's own Wrangler binary is the same version as the root
binary, and its exact deploy command passes a compile-only check. This rules out
the local artifact CLI as the cause; the remaining rejection is during live
upload.

The currently deployed version is also readable through the same Wrangler
context and contains both expected R2 and Queue binding names. The remaining
problem is therefore a live upload/context rejection before version creation.

Having all Cloudflare account privileges does not guarantee that Wrangler's
saved OAuth grant selected the same account and scopes. The next manual step is
to re-authenticate Wrangler for the intended account, then let me rerun only
read-only checks. Do not deploy during re-authentication.

Reauthentication is complete, and the read-only checks still pass. The next
step is one fresh monitored candidate attempt with automatic rollback to test
the live upload path. It cannot start until you give a new exact approval.

That approved attempt has now reproduced the same pre-version failure for the
third time. Deployment/version listings still show no candidate or rollback
record, and preview health remains healthy. I am stopping further retries until
Cloudflare exposes a provider-side cause or an explicitly approved provider
change is made.

The exact candidate artifact also passed a non-mutating Wrangler compile check:
it built successfully, produced no error stream, and did not deploy. That means
the remaining failure is in the live provider dispatch path, not a local build
failure.

The owner then checked the dashboard again: the Queue and R2 binding pairs
match the expected preview resources, and neither Deployments nor account Audit
Logs contains a failed attempt. Both pinned candidate and rollback commits also
contain the same expected preview binding names. The remaining
`resource_missing` label is therefore not yet specific enough to prove that a
resource is absent; it comes from a deliberately broad, privacy-safe Wrangler
error classifier. No further deployment retry is planned until that classifier
records a safe failure fingerprint (source channel and matched category) without
retaining provider output.

That diagnostic-only classifier repair is now saved. Its local contract records
only an allowlisted signature and source channel, and all 15 provider-free
controller safety scripts plus documentation coverage pass. No Cloudflare
request occurred. A new exact approval is required before using the fingerprint
on one monitored live attempt.

That approved fingerprinted attempt is now complete. Both the candidate and
automatic rollback matched the safe `not_found` signature in Wrangler's bounded
temporary log; no stdout/stderr text was retained. The candidate was not
accepted, rollback was not verified, deployment/version lists still show no
candidate or rollback record, and preview health remains healthy. The diagnosis
is now narrowed to a provider request that reports a generic not-found result
without identifying the object; no further retry is safe without provider-side
support evidence or an explicitly approved provider-state change.

The saved local logs do not contain the original error text: stderr is empty and
the controller deliberately deletes its temporary Wrangler log after extracting
the safe category. The preview Queue and R2 names in the root and reviewed
configurations exactly match the dashboard. Do not run an unqualified
`wrangler deploy --verbose` command; the root configuration is local, not the
preview Worker. The earlier Cloudflare R2 availability issue affecting a small
number of ENAM buckets began at 18:42 UTC on 2026-08-07 and overlapped the
failed attempt. Cloudflare's status page listed R2 as operational when checked
on 2026-08-10, so the incident is now historical; it remains a plausible
cause, not proof that our specific bucket was affected. One fresh retry was
authorized after the resolution but stopped before upload because the required
schedule confirmation was not submitted in time.

The newest observer-only attempt got past workflow admission and created its
listener, but the local controller still stopped before candidate deployment.
Safe checks showed the workflow identity, listener topology, correlation
artifact, and API capacity were all valid; replaying that same metadata locally
worked. The issue was therefore a transient provider-metadata read/timing race,
not Cloudflare or the Vision Worker. The resolver now makes one short retry for
that narrow case while still stopping on timeouts, cancellations, and malformed
metadata. All local gates pass; the one monitored candidate-and-rollback proof
is still the remaining Phase B acceptance step.

## Completed

### Runtime Task 1 — Application foundation

Vision now has its first working application shell:

- A React page that displays `Vision` and `Foundation status`.
- A Cloudflare Worker API with a health check.
- Strict TypeScript configuration.
- A production build that completes successfully.
- A simple and a technical reference for every production file created in this task.

The task was independently reviewed and approved with no findings.

### Runtime Task 2 — Automatic checks

Vision now automatically checks that:

- Every production file and function has both the simple and technical explanation.
- Meaningful folders have both explanation layers.
- Source files and functions contain the required code documentation.
- The Worker health endpoint behaves correctly inside the Cloudflare-compatible runtime.
- Chromium can open the application and see the expected Vision screen.

The task required several focused corrections to avoid missing or incorrectly rejecting valid documentation. After those corrections, independent review approved it with no remaining findings.

### Runtime Task 3 — Safe errors and logs

Vision now gives API errors a consistent, private response containing only a safe code, message, and random request ID. Its structured logger rejects unexpected or hidden fields before anything is written, and entity references must use opaque UUIDs instead of private text.

Even if the logging destination fails, Vision still returns the safe API response. Independent review approved the hardened implementation with no remaining findings.

### Runtime Task 4 — Delivery safeguards

GitHub can now check every proposed change automatically. Preview and production workflows verify one exact commit and deploy that same commit, so a branch cannot change while approval is waiting. Production also requires an exact confirmation phrase in addition to its GitHub environment gate.

The repository implementation passed review. The hosted preview is live at
`https://vision-preview.june74.workers.dev`: its page renders `Vision` and
`Foundation status`, and its health endpoint returns the expected safe response.
The Runtime and continuous integration milestone is complete.

## In progress

### Domain Task 1 — Canonical records and categories

Vision now has provider-independent definitions for its graph, events,
categories, and privacy levels. Every canonical record must have a complete
provider or first-party identity, category values cannot contradict their
confirmation state, and AI inference cannot lower privacy or authorize
sharing.

The task passed 17 focused tests and the full project check. Independent
review initially found two contract gaps; both were corrected, tested, and
approved with no remaining findings.

### Domain Task 2 — PostgreSQL foundation

Vision now has a reviewed eight-table PostgreSQL design for canonical records,
events, relationships, audit facts, synchronization state, operation records,
and recoverable deletion. Automated checks compare the reviewed SQL, Vision's
typed schema, and generated migration snapshot so a weakened constraint or
protected-field type cannot drift silently.

Database writes now protect owner boundaries even when two synchronizations
race. Vision accepts only a dedicated `vision_app` database credential and
returns safe identity conflicts without exposing private values.

The task required several review and repair rounds. Final independent review
approved both the specification and implementation quality with no remaining
findings. No live Neon database has been created or contacted yet.

### Domain Task 3 — Protected-field encryption

Vision can now encrypt private calendar and note fields with authenticated
AES-256-GCM envelopes. Each field is bound to its owner, record, field name,
category, and key version, so encrypted values cannot be moved to another
context. Per-user/category keys support safe rotation and historical
decryption without allowing version rollback.

Security checks also keep the test key provider out of production builds,
bound hostile input sizes before decoding, and validate the Worker root key
without exposing it. The task passed 36 focused crypto tests, 71 unit tests,
and final independent review with no remaining findings.

### Domain Task 4 — Encrypted persistence and safe audit

Vision now encrypts protected event content before PostgreSQL persistence,
keeps planning queries free of encrypted payloads, and decrypts only after a
private owner-and-privacy authorization decision. Safe audit records accept
only a fixed metadata allowlist and reject protected or unexpected values.

Database writes enforce strict provider ordering and exact node facts. The
matching node is locked for the event write so a concurrent category, privacy,
or version change cannot silently admit content under stale rules.

The task passed 100 main tests and 4 Worker tests. Final independent review
approved both the specification and implementation quality with no findings.
A live Neon concurrency check remains a later external acceptance gate.

### Domain Task 5 — Recoverable deletion

Vision now keeps confirmed deletions recoverable for exactly 30 days. A record
can be restored only before the deadline without changing its encrypted
content. At or after the deadline, an authorized background purge permanently
removes ciphertext, relationships, and the recovery record in one database
operation, while retaining only a non-sensitive audit fact.

Owner-scoped deletion and restoration cannot cross user boundaries. Purge
workers use a separate private system authorization, lock and re-check records
under races, and stop safely if the required audit fact cannot be inserted.
Repeated restores or purges are deterministic and idempotent.

The task passed 121 main tests and 4 Worker tests. Final independent review
approved both the specification and implementation quality with no findings.
The Domain, data, and privacy milestone is complete. Live Neon migration,
least-privilege, and true multi-session concurrency checks remain external
acceptance gates.

### Authentication Task 1 — Private-pilot identity and setup policy

Vision now has pure server-side rules for admitting only the configured Google
identity and for moving calendar setup through its allowed states. Identity
checks require the exact trusted issuer and client audience, an unexpired
verified email, and both the allowlisted subject and normalized email.

Calendar creation requires the exact phrase `CREATE VISION CALENDAR`. Every
state change uses a current version, rejects stale or duplicate commands, and
safely snapshots hostile inputs before evaluating them.

The task passed 155 main tests and 4 Worker tests. Independent review approved
both the specification and implementation quality with no blocking findings.

### Authentication Task 2 — Google OAuth and Vision sessions

Vision now owns the complete Google sign-in exchange on the server. It uses
state, PKCE, nonce, exact redirect and narrow Calendar scopes, verifies the
Google identity before creating a session, and stores retained tokens only as
encrypted database values.

Sessions use private cookies, rotate after sign-in, support logout, and require
CSRF protection for state-changing requests. OAuth starts are rate-limited and
expired transactions are physically cleaned up. Concurrent callbacks cannot
replace a newly issued refresh token with an older retained value.

The task passed 179 main tests and 15 Worker tests. Independent review approved
both the specification and implementation quality with no blocking findings.
No live Google account, Neon database, or Cloudflare secret was used.

### Next — Calendar discovery and setup APIs

Discover owned secondary calendars, connect an explicitly selected existing
Vision calendar, or create exactly one after current explicit confirmation.

### Authentication Task 3 - Calendar discovery and setup APIs

Vision now discovers calendars through stable IDs, excludes the primary and
non-owned calendars, and requires explicit selection of an existing `Vision`
calendar. New creation requires exact confirmation, the current setup version,
and one idempotency key. Lost provider responses are reconciled without a
second create.

Provider timeouts and streamed responses are bounded, discovery is
CSRF-protected and crash-recoverable, and abandoned operations can be safely
reconciled after their lease expires. No event insert, update, or delete path
is reachable.

The task passed 193 main tests and 30 Worker tests. Independent review
approved both the specification and implementation quality with no blocking
findings. One non-blocking minor remains for a takeover CAS loser to reload
the durable winner instead of returning a transient generic error.

### Next - Authenticated setup interface

Build the browser states for sign-in, discovery, explicit choice, exact
confirmation, creation, connection, and action-required recovery.

### Authentication Task 4 - Authenticated setup interface

Vision now provides the private-pilot browser flow for sign-in, owned-calendar
discovery, explicit selection, exact confirmation, creation, connection, and
safe recovery. Creation replay keeps the original setup version and idempotency
key, while terminal failures require fresh discovery before a new attempt.

The focused Chromium suite passed 10/10. Independent review approved the task
with four non-blocking minor follow-ups. The broader gate encountered unrelated
PGlite setup-hook timeouts; no Task 4 browser failure was observed.

### Historical implementation sequence

The following sections preserve the original task-by-task implementation
narrative. Their historical wording is not the current release status; use the
completion evidence linked above for what has actually passed.

### Authentication Task 5 - Acceptance preparation

The repeatable OAuth and disposable-calendar acceptance procedure is now
documented, with redacted evidence fields and preview workflow guards. No
external account, database, Worker, or secret was changed.

The focused workflow policy test passed 2/2 and documentation coverage passed.
The real acceptance run is paused until you approve the named external setup.

## Historical note — superseded by current evidence

The original draft ended with a statement that Google login, calendar
connection, database, AI, alerts, and deployment did not yet exist. That was
true before the Phase B implementation and live setup work; it is retained only
as history and must not be used as the current project status.

## Current live-acceptance checkpoint — 2026-08-10

A fresh approved retry was started after the Cloudflare R2 incident was
resolved. The owner confirmed the two normal schedules, so the controller
reached the upload boundary. Cloudflare again returned a safe resource-missing
failure before creating a candidate version, and the automatic rollback could
not be verified. A bounded read-only deployment-list reconciliation then
decoded successfully and showed no candidate or rollback marker. No manual
retry is safe; the next step requires a Cloudflare diagnostic or an explicitly
approved provider-state change. The owner also manually confirmed that the
active deployment, both bindings, and both underlying resources exist, so the
remaining uncertainty is inside Cloudflare's pre-version upload path.
