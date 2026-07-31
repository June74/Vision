# `src/jobs/scheduled.ts`
## `temporaryRestore`
Keeps restore behind admission.

## `clearTarget`
Composes the narrow disposable-target clear adapter.

## `createTarget`
Composes the preview-only disposable Neon restore target.

## `readTargetSnapshot`
Reads and retains one consistent post-restore snapshot.

## `countReadableEvents`
Counts audit events from the retained or freshly read restored snapshot.

## `createWithWriter`

Carries the `BackupObjectWriter` substitution through normal snapshot and
encryption setup without widening ordinary recovery behavior.

## `runR2Upload`

The temporary candidate creates recovery dependencies only after strict
preview-scenario admission; its supplied writer fails before R2 `put`.

The scheduled entry point routes exact cron expressions to isolated
Google-maintenance and encrypted-recovery capability sets. A generated
preview-only artifact may add the one-minute cron and exactly one admitted
role-probe, foundation, AI-usage, or fault capability. The committed normal
configuration has no one-minute cron or acceptance binding.

## `runScheduledJob`
Matches only the three configured cron expressions and rejects any unexpected
scheduled event.

## `runScheduledRecovery`
Awaits verified daily creation before retention, so a failed backup can never be followed by a destructive purge.

## `maintenance`
Lazily constructs and executes only the existing calendar maintenance dependencies.

## `recovery`
Lazily constructs and executes only backup and retention dependencies.

## `temporaryRoleProbe`
Lazily runs the injected preview role-probe job, emits exactly the
`backup.restore-role-probe` action plus closed evidence, and throws only a
fixed value-free failure after failed evidence is emitted.

## `foundationProbe`

Runs only after the generated `foundation_probe` selector is parsed; normal
cron routing and every other selector leave it unreachable.

## `aiUsageEvidence`

Runs only after the generated `ai_usage` selector and exact same-run boolean
attestation are parsed and the one-minute event equals the immutable
`evidenceScheduledAt`. The parsed window is passed unchanged; normal cron
routing and every other selector leave this boundary unreachable.

## `createScheduledPhaseBAiUsageEvidenceDependencies`

Requires the same-run verifier result to be exactly true, then composes the
atomic candidate-count and monthly aggregate AI source plus content-free
status/calendar sources over one owner-bound database.

## `createProductionScheduledPhaseBAiUsageEvidenceDependencies`

Rejects non-preview execution and an unattested boolean before database
construction. It derives the existing authentication-compatible owner key and
does not construct a provider client, selector, binding, or cron.

## `runProductionScheduledPhaseBFoundationProbe`

Builds the preview-only foundation source from one max-one Neon pool, the
read-only R2 adapter, frozen privilege manifest, opaque owner derivation, and
existing wrapped-key provider. It emits one fixed terminal record and reports
failure with a value-free error.

## `connect`

Retains one database client behind the foundation source's narrow pool port.

## `query`

Copies only result rows from parameterized queries; driver metadata does not
cross the source boundary.

## `release`

Returns the retained client to the max-one pool.

## `end`

Closes the dedicated foundation pool after probe cleanup.

## `decryptControlledTitle`

Parses and decrypts only the controlled sentinel title and returns a mutable
UTF-8 byte array for the probe's `finally` cleanup.

## `runScheduledPhaseBAiUsageEvidence`

Calls Task 4's atomic count read with only `activatedAt` and
`evidenceScheduledAt`. `0/0` and `1/0` return `waiting` before all downstream
reads; only `1/1` executes the established evidence job and returns `emitted`.
Unsafe integers, impossible relationships, or counts above one emit one
canonical inconsistent terminal and throw a fixed value-free error. No
at-most-once state is introduced, so duplicate scheduled delivery can emit two
records for the observer to reject.

## `emitTemporaryPreviewRoleProbeEvidence`
Writes only the exact allowlisted action/evidence object.

## `runScheduledCalendarMaintenance`
Runs projection cleanup and repair before renewal, isolates all three
operations, reconstructs and emits exactly one closed maintenance record, and
rethrows only after every maintenance path has been attempted. Cleanup failure
maps to the repair side without extending the five-key evidence schema;
throwing still prefers cleanup, then repair, then renewal.
## `cleanupProjectionRebuilds`
Invokes the owner-scoped database-only projection retention boundary before credential-dependent renewal; it never fetches events or reads OAuth tokens.
## `recordCredentialFailure`
Routes typed OAuth failure through the generation-safe maintenance checkpoint transition before rethrowing.
## `scheduled`
Uses Cloudflare's scheduled time and exact cron string for
capability-separated dispatch. Candidate selector, same-run AI attestation,
AI-window shape, mutual exclusion, and protected-window checks occur before
cron work. Only the temporary one-minute AI branch compares the scheduled
event with `evidenceScheduledAt`; a preceding or following minute returns
before injected wall-clock access or dependency construction. The exact tick
then applies the ordinary expiry guard before any read. Quarter-hour
maintenance and daily recovery never enter tick matching, even at the same
timestamp, but still reject malformed, expired, delayed, or protected
candidates before permanent work.
## `createProductionScheduledEntryDependencies`
Returns closures rather than constructed adapters, preserving lazy provider,
database, Queue, and R2 initialization until after exact dispatch.
## `currentTime`
Returns a fresh wall-clock `Date` for temporary lifetime admission only.
## `temporaryFaultR2Upload`
Constructs normal recovery dependencies after admission and calls
`createWithWriter`; it never runs retention and cannot convert an earlier
head, snapshot, or encryption failure into fault evidence.
## `writeTemporaryFaultEvidence`
Delegates only the closed `TemporaryPreviewFaultEntry` to the console after the
job has established the canonical terminal condition.
## `createProductionTemporaryRoleProbeDependencies`
Constructs only the max-one role-probe adapter. The temporary branch cannot
reach restore, clear, R2, backup-key, target-identity, table, or HTTP code.
## `probeRole`
Constructs the adapter from the already validated temporary connection string,
executes the fixed read-only predicate, and awaits cleanup before returning the
boolean.
## `createProductionScheduledRecoveryDependencies`
Validates the separate key/version, imports a non-extractable key, and constructs the R2 and repeatable-read Neon
adapters.
## `create`
Runs conditional encrypted backup creation and post-write verification.
## `purge`
Runs strict-admission 30-day retention only after creation succeeds.
## `createProductionScheduledCalendarMaintenanceDependencies`
Validates configuration, restores owner-bound keys and OAuth state, refreshes near-expiry access, and constructs the channel-only adapter.
## `verify`
Keeps the refresh client from becoming an ID-token boundary.
## `renew`
Invokes the channel state machine.
## `watch`
Supplies the fixed callback URI inside the trusted process.
## `stop`
Delegates exact channel cleanup.
## `createChannelId`
Uses 192 bits of Web Crypto randomness.
## `createChannelToken`
Uses 256 bits of Web Crypto randomness.
## `createLeaseId`
Uses independent opaque randomness for one database-elected renewal attempt.
## `encryptToken`
Encrypts the token with owner and row authenticated metadata; SQL uses only its digest.
## `repair`
Invokes deterministic repair reservation.
## `resolveScheduledGoogleAccessToken`
Lazily restores and refreshes OAuth state for provider channel calls while classifying refresh and persistence failures through the Task 3 sync taxonomy.
## `refreshAccessToken`
Injects the refresh-only OAuth operation so adversarial tests exercise the production classifier without network calls.
## `now`
Provides a single scheduler timestamp for the expiry threshold and compare-and-swap token update.
## `randomOpaque`
Encodes random bytes as canonical base64url.
## `sha256Base64Url`
Produces a fixed-size digest.
## `deriveOwnerId`
Matches authentication's opaque owner derivation.
## `readScheduledOwnerSubject`
Validates the bounded existing subject used only for private owner derivation;
rejection never includes the supplied value.
