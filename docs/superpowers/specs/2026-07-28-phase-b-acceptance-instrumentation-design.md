# Phase B Acceptance Instrumentation Design

**Status:** Approved for specification on 2026-07-28

**Phase:** B — data foundation

**Execution:** Subagent-driven development with test-first implementation and
independent task review

**Live boundary:** Preview only until the temporary surfaces are removed and
the reviewed normal Worker is redeployed

## Goal

Add the smallest privacy-safe mechanisms needed to produce truthful live
evidence for the remaining Vision Phase B completion gates without enabling
event-level Google writes, exposing protected data, weakening authentication,
adding a permanent public operator API, or introducing new secret material.

The implementation must close four known gaps:

1. classify the normal 15-minute calendar-maintenance outcome;
2. prove live graph, privacy, provenance, privilege, and storage invariants
   using fixed-shape aggregate evidence;
3. replace hard-coded database and R2 usage warnings with measured inputs and
   produce fixed-shape AI usage evidence;
4. exercise required operational failure states through a reversible,
   preview-only fault harness.

It must also extend the final cleanup contract so the temporary acceptance
instrumentation is removed together with the temporary restore and role-probe
runtime.

## Existing live paths

The implementation extends confirmed reachable paths rather than similarly
named helpers:

```text
Cloudflare scheduled event
  -> scheduled()
  -> runScheduledJob()
  -> runScheduledCalendarMaintenance()
  -> reserve missed-signal repair and renew eligible Google channels
```

```text
Authenticated Vision desk
  -> loadFoundationSnapshot()
  -> GET /api/diagnostics/status
  -> createProductionDiagnosticDependencies()
  -> DiagnosticRepositoryPort.readFoundationFacts()
  -> calculateFoundationHealth()
  -> FoundationStatus and CostStatus
```

```text
Guarded preview workflow
  -> start safe-tail observer
  -> prove observer is active
  -> deploy one exact reviewed candidate
  -> classify one fixed-shape terminal record
  -> immediately redeploy the immutable normal Worker
```

The temporary role-probe and fenced-restore candidates remain immutable and
are deployed only at their already reviewed commits. New implementation does
not amend those historical candidates.

## Chosen approach

Use one temporary preview acceptance candidate plus permanent value-free
maintenance telemetry.

The candidate is activated only when:

- `VISION_ENV` is exactly `preview`;
- one strict non-secret acceptance-scenario binding is present;
- the generated preview configuration contains the temporary one-minute
  schedule;
- the observer-only workflow is already active;
- the deployment is attributed to the exact reviewed candidate commit.

The acceptance scenario is an allowlisted enum. Unknown, missing, malformed,
or contradictory configuration fails closed before database, R2, Google, AI,
Queue, or diagnostic access.

The candidate never adds a public operator route. Read-only probes run from the
scheduled entry point. UI failure-state exercises use a preview-only
dependency overlay inside the already authenticated diagnostics path. When no
acceptance scenario is configured, the overlay is unreachable and normal
diagnostics use only repository facts.

## Rejected alternatives

### Permanent authenticated operator routes

This would reduce the number of temporary deployments but permanently expand
the network-reachable API and authorization surface. The evidence work is
finite, so the additional attack surface and long-term maintenance are not
justified.

### Direct provider scripts for every gate

This would avoid temporary Worker code but require additional database or
provider credentials outside the Worker, duplicate application boundary
logic, and make secret transfer the dominant risk. Provider dashboards remain
valid sources for aggregate billing evidence, but application invariants are
proved through the application runtime.

### Manual dashboard inspection only

Manual inspection can verify plan state and aggregate billing, but it cannot
prove application graph invariants, failure-state precedence, safe logging, or
normal scheduled behavior. It remains supplementary rather than sufficient.

## Global constraints

- Version 1 remains one private user.
- No event-level Google create, edit, move, cancel, or delete capability is
  added or enabled.
- Google authorization and revocation remain user-controlled external actions.
- Outputs contain only allowlisted booleans, bounded counts, durations,
  timestamps, enum categories, and fixed version strings.
- Outputs never contain URLs, provider identifiers, object keys, branch
  identifiers, owner identifiers, event identifiers, emails, titles,
  descriptions, attendees, locations, calendar content, OAuth values,
  credentials, tokens, cookies, database connection strings, raw rows,
  ciphertext, plaintext samples, hashes derived from protected content, or
  error messages from providers.
- No new secret is introduced for acceptance instrumentation.
- No schema migration is introduced. The acceptance mechanisms use existing
  migration-9 tables, bindings, and durable state.
- The normal runtime behaves identically when the temporary scenario binding
  and one-minute cron are absent.
- Every temporary scenario is bounded to one candidate deployment and one
  terminal evidence record.
- Any malformed, missing, duplicate, failed, ambiguous, or unattributable
  record stops the acceptance path.
- The normal Worker is redeployed immediately after every terminal result,
  whether the result succeeds or fails.
- `BACKUP_ENCRYPTION_KEY` is never read for reporting, rotated, replaced, or
  deleted. Backup key version remains 1.
- `backups/v1/` is never deleted. The only permitted R2 deletion remains the
  separately approved opaque restore-attempt marker after destructive restore
  code is inactive.
- The approximately $20 monthly ceiling and the exact $9.50 AI stop remain
  non-compensating release gates.

## Component 1: Normal calendar-maintenance evidence

### Responsibility

Return and emit a fixed-shape result for the existing 15-minute maintenance
path while preserving its current repair-before-renewal ordering and failure
semantics.

### Contract

The maintenance result uses one versioned schema:

```text
evidenceType: vision.calendar-maintenance/v1
outcome: succeeded | failed
category: none | repair_failed | renewal_failed | repair_and_renewal_failed
repairOutcome: reserved | no_work | failed
renewalOutcome: completed | no_work | failed
```

No counts tied to a calendar, channel, owner, or provider identity are emitted.
If both operations fail, the record reports the combined category after both
have had their existing opportunity to run.

The scheduled entry point emits exactly one record, then preserves the current
throw/failure behavior so Cloudflare does not mistake a failed maintenance run
for success.

The safe-tail classifier accepts this schema only for the exact normal
maintenance cron. Maintenance evidence on another cron, recovery evidence on
the maintenance cron, extra keys, wrong types, unknown categories, multiple
terminal records, or raw provider error text is rejected.

### Persistence

None. This is permanent, value-free operational telemetry for the normal
runtime.

## Component 2: Read-only foundation acceptance probe

### Responsibility

Run bounded, owner-scoped, read-only assertions against the live application
database and R2 binding and return one aggregate record without exposing the
records being checked.

### Database checks

The probe uses one retained max-one database client and parameterized SQL. It
does not mutate, lock application rows for update, invoke provider calls, or
decrypt arbitrary protected content.

It returns booleans and bounded counts for:

- current database role is the required application role;
- required migration-9 tables and signature columns are present;
- application-role privileges match the reviewed allowlist;
- `PUBLIC` has zero grants on protected application tables;
- provider identities have complete canonical identity facts;
- concrete domains use only valid domain states;
- unresolved domains remain unresolved;
- stored privacy values are valid and no inferred operation lowers privacy;
- synchronized records carry required source and category provenance;
- governed edges reference existing, owner-compatible nodes;
- provider revisions and synchronization checkpoints satisfy their structural
  contracts;
- protected fields use binary envelope columns rather than plaintext columns;
- required raw-storage sentinel checks, when a separately controlled
  disposable test record exists, return absence booleans without returning or
  deriving output from the sentinel value.

The disposable sentinel exercise uses one user-created provider event in the
already connected secondary calendar during a bounded acceptance window.
Vision remains read-only: the user creates and later deletes that event through
Google, not through a Vision event-write API. The probe proceeds only when
exactly one synchronized event is eligible in that window, resolves it
internally without emitting its identity, and clears any application-controlled
plaintext buffer after the comparison.

If no uniquely eligible disposable sentinel record exists, the sentinel field
reports `not_tested`; it never converts missing or ambiguous evidence into
success.

### R2 checks

The probe uses bounded listing and authenticated object validation already
available to backup code. It reports only:

- encrypted daily backup present for the required date;
- stored format and key version supported;
- authenticated metadata and ciphertext digest shape valid;
- protected sentinel absent when the controlled sentinel exercise is active;
- object count and aggregate byte count fall within validated numeric bounds.

It never emits, returns, or persists an object key, prefix result, checksum,
ciphertext, metadata body, or provider error.

### Evidence contract

The record uses:

```text
evidenceType: vision.phase-b-foundation-probe/v1
outcome: succeeded | failed
category: allowlisted failure category | none
roleMatches: boolean
schemaMatches: boolean
privilegesMatch: boolean
publicGrantCount: bounded integer
identityViolations: bounded integer
domainViolations: bounded integer
privacyViolations: bounded integer
provenanceViolations: bounded integer
referenceViolations: bounded integer
checkpointViolations: bounded integer
protectedStorageMatches: boolean
sentinelStatus: passed | failed | not_tested
backupContractMatches: boolean
databaseBytes: bounded integer
r2ObjectCount: bounded integer
r2Bytes: bounded integer
```

All integers are admission-bounded before serialization. A bound violation
produces a constant category, not the rejected value.

## Component 3: Measured usage and AI evidence

### Application-visible usage

Replace the hard-coded database and R2 warning booleans in production
diagnostic dependency assembly with a narrow `UsageWarningSource`.

The source consumes only:

- current database byte count from a read-only aggregate query;
- current R2 object count and aggregate bytes from a bounded listing;
- validated, injected non-secret warning thresholds.

The source returns booleans only to the diagnostic repository. Provider plan
limits and warning thresholds are configuration, not source-code assumptions,
so a pricing or quota change can be updated without changing application
logic.

If usage cannot be measured, the status must not silently report `false`.
Measurement unavailability produces an allowlisted actionable warning or safe
error state.

Provider compute-hour, request, and billing totals that the Worker cannot
authoritatively obtain remain fixed-shape operator evidence from the provider
dashboard or an existing guarded credential boundary. The application does not
invent those values.

### AI evidence

The existing durable AI ledger remains the application authority for admitted
monthly spend. A fixed-shape operator record reports:

```text
evidenceType: vision.ai-usage/v1
outcome: succeeded | failed
category: none | unavailable | inconsistent | limit_exceeded
monthlyCents: bounded integer
warningAtCents: 800
optionalStopAtCents: 900
hardStopAtCents: 950
tier: normal | warning | optional_stopped | stopped
gatewayLimitMatches: boolean
nonAiAvailable: boolean
```

The harmless live category request used for acceptance contains minimum
context and no protected calendar content. The record never contains the
prompt, response, model output, request identifier, token value, or provider
account data.

Application-ledger and provider aggregate evidence must be consistent within
the explicitly documented observation window. A mismatch remains a failed or
inconclusive gate rather than being averaged away.

## Component 4: Reversible preview fault harness

### Responsibility

Exercise the deployed authenticated API and rendered UI through exact
preview-only scenarios without changing permanent policy, bypassing
authentication, disabling authorization, or creating provider events.

### Scenario contract

The allowlisted non-secret scenario values are:

- `queue_delayed`;
- `job_failed`;
- `channel_expired`;
- `database_unavailable`;
- `r2_upload_failed`;
- `ai_stopped`.

Real Google revocation is not simulated for final acceptance. It remains a
separate user-controlled live exercise after normal synchronization evidence
is captured.

### Diagnostic overlays

`queue_delayed`, `job_failed`, `channel_expired`, `database_unavailable`, and
`ai_stopped` replace only the minimum content-free facts passed into
`calculateFoundationHealth`. The existing session and owner authorization must
succeed first. The overlay cannot issue database writes, provider calls, Queue
messages, or R2 operations.

The resulting API response must use the existing exact diagnostic schema and
the UI must render the expected `Delayed`, `Action required`, or
`Disconnected` state with an actionable safe message. It must never render
`Healthy` or claim completion for the injected failure.

`database_unavailable` represents an observed dependency-unavailable fact
after authentication; it does not disable the session store or bypass
authentication to manufacture a page. It proves the deployed status and UI
response to an unavailable database fact; adapter contract tests separately
prove driver failure classification. It is not represented as evidence of an
actual Neon outage.

### Scheduled dependency failures

`r2_upload_failed` replaces only the backup object-write dependency with a
constant failing test boundary before any object mutation. The scheduled path
must emit one safe failure category, preserve any prior valid backup, and
avoid claiming success. It proves the deployed scheduled and operational
response to the failure boundary; R2 adapter contract tests separately prove
provider-response classification. It is not represented as evidence that R2
itself was unavailable.

The AI stop scenario uses the real deterministic 950-cent admission policy and
proves that calendar viewing and deterministic synchronization remain
available. It does not increase the provider limit or create paid traffic
beyond the separately approved harmless request.

### Containment

For every scenario:

1. prove the observer is active;
2. deploy the exact candidate with one scenario;
3. accept one fixed-shape terminal record;
4. verify the authenticated API and UI state required by that scenario;
5. redeploy the immutable normal Worker immediately;
6. verify normal health and the two normal schedules;
7. verify the one-minute trigger and scenario binding are absent.

No two fault scenarios run in one deployment.

## Security and privacy boundary

- Acceptance-mode parsing occurs before scenario-specific dependency
  construction.
- Production rejects every acceptance scenario.
- Local tests may inject dependencies directly; deployable production and
  preview bundles contain no fixed credential, test root key, protected
  fixture, sentinel value, or authorization bypass.
- All SQL is parameterized and aggregate-only.
- Every database query is owner-scoped where owner data is involved.
- R2 listing is bounded before aggregation.
- Safe-tail parsing uses bounded incremental framing and does not retain raw
  lines.
- Classifiers accept plain own-enumerable objects with exact key sets and reject
  accessors, prototypes, symbols, hidden keys, extra keys, unbounded integers,
  duplicate terminal records, and mixed evidence types.
- Logger, classifier, workflow artifact, generated Worker bundle, and client
  bundle scans reject protected values and temporary secret material.
- Public error envelopes remain constant and contain no provider response text.
- The fault harness cannot be activated by a browser request, query parameter,
  cookie, header, database row, Queue message, or model output.

## Error handling

Every component fails closed:

- invalid configuration stops before dependency access;
- unavailable telemetry becomes explicit unavailable evidence;
- a read assertion failure returns one allowlisted category and no rejected
  value;
- a provider or driver exception is classified at its boundary and is never
  serialized directly;
- observer startup failure prevents deployment;
- missing or duplicate evidence prevents acceptance;
- candidate failure still triggers immediate normal-runtime restoration;
- rollback attribution, health, and schedule verification are mandatory even
  after a failed acceptance scenario.

## Testing strategy

Implementation follows test-driven development.

### Unit tests

- exact environment and scenario admission;
- maintenance result/category precedence;
- usage thresholds and unavailable telemetry;
- diagnostic overlay mapping for every scenario;
- exact evidence schemas, numeric bounds, hostile objects, duplicate records,
  incremental framing, and raw-line non-retention;
- production rejection and inactive-normal behavior.

### Integration tests

- database role, schema, privilege, identity, domain, privacy, provenance,
  reference, checkpoint, and protected-storage aggregate queries;
- max-one client release and pool closure;
- bounded R2 aggregation and authenticated backup validation;
- scheduled maintenance and forced R2 failure paths;
- diagnostic repository assembly with measured usage;
- exact harmless AI request admission and ledger evidence using simulated
  provider transport;
- failure atomicity and cleanup after every temporary scenario.

### Worker tests

- authenticated status responses for all fault states;
- unauthenticated and wrong-owner rejection before overlay access;
- exact diagnostic response shape;
- normal behavior when the scenario binding is absent;
- no public operator route and no event-write route.

### Browser tests

- deployed-shape UI renders each required state and actionable safe copy;
- no event create, edit, move, cancel, or delete controls appear;
- non-AI calendar viewing remains available at the hard AI stop;
- normal responsive and keyboard behavior remains unchanged.

### Policy and release tests

- observer-before-deploy ordering;
- separate observer and mutation concurrency;
- exact one-scenario workflow admission;
- immediate normal rollback;
- preview-only temporary cron and binding;
- no secret value or raw log persistence;
- Worker/client bundle protected-value scans;
- final cleanup residue scan.

Every implementation task receives independent specification and code-quality
review. Critical and Important findings are fixed and re-reviewed before the
next task.

## Live acceptance order

Implementation and local review may finish before the pending human connection
copy. Live execution remains:

1. complete the already reviewed read-only database-role probe;
2. immediately restore the normal Worker;
3. run the already reviewed fenced restore with its observer active;
4. restore normal runtime and delete the two temporary restore secrets;
5. delete only the opaque restore-attempt marker;
6. run the new foundation probe and bounded fault scenarios;
7. capture normal sync timing and missed-signal repair;
8. capture the user-controlled wrong-account and revoked-authorization cases;
9. capture harmless AI and aggregate provider cost evidence;
10. remove all temporary role-probe, restore, acceptance-probe, scenario,
    one-minute cron, workflow-mode, environment, tests, and generated-reference
    surfaces;
11. deploy and verify the exact reviewed cleanup;
12. permanently delete only the attested disposable database branch;
13. finish the complete Phase B evidence map and Phase C handoff.

## Cleanup amendment

The final cleanup is a surgical unwind from the latest post-acceptance evidence
head, not a reset or byte-for-byte revert to an older commit.

Delete:

- temporary role-probe adapter, job, tests, schemas, workflow mode, and
  generated references;
- temporary fenced-restore clear adapter, attempt store, job, tests, schemas,
  workflow mode, and generated references;
- temporary Phase B acceptance probe, scenario overlays, one-minute routing,
  tests that exist only for temporary reachability, and generated references.

Retain:

- permanent prepared-backup importer and offline restore tooling;
- permanent Worker-bundle protected-value scanning;
- permanent normal maintenance evidence;
- hardened ordinary safe-tail framing and closed failure classification;
- observer/mutation workflow separation and bounded timeouts;
- measured normal database/R2 usage warnings;
- the existing normal maintenance and daily backup schedules;
- complete setback, credential lifecycle, restore, and release evidence;
- unchanged backup key version 1 and all encrypted daily backups.

Provider cleanup remains separate from source cleanup. Temporary Worker secrets
are deleted only after normal runtime is active. The opaque attempt marker is
deleted only after destructive code is inactive and those secrets are absent.
The disposable database branch is deleted only after the reviewed cleanup is
deployed and all restore preconditions are reconfirmed.

## Out of scope

- Phase C event create, edit, move, cancel, and delete operations;
- a permanent operator dashboard or public acceptance API;
- additional calendar providers;
- production deployment of temporary acceptance modes;
- new OAuth, database, R2, AI, or deployment credentials;
- backup-key rotation;
- organization calendars, mobile clients, desktop clients, email ingestion,
  voice capture, or other later-phase product features.

## Acceptance criteria

The design is implemented only when:

- the four instrumentation gaps have focused RED/GREEN evidence;
- the complete local repository and browser gates pass;
- every task has independent clean review;
- exact immutable candidate and cleanup commits are pushed;
- all live records match their exact fixed schemas;
- every temporary deployment is followed by verified normal rollback;
- no protected value, identifier, provider URL, credential, or secret appears
  in evidence;
- the required live Phase B gates are mapped to current evidence;
- all temporary runtime and provider surfaces are removed in the approved
  order;
- the backup key remains unchanged at version 1 and `backups/v1/` remains
  intact;
- Phase B is marked complete only after every separate completion gate passes.
