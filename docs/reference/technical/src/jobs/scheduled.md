# `src/jobs/scheduled.ts`

The scheduled entry point routes exact cron expressions to isolated
Google-maintenance, encrypted-recovery, and temporary preview-restore
capability sets. The normal branches never construct the restore target, and
the temporary restore path never receives the normal `DATABASE_URL`.

## `runScheduledJob`
Matches only the three configured cron expressions and rejects any unexpected
scheduled event.

## `runScheduledRecovery`
Awaits verified daily creation before retention, so a failed backup can never be followed by a destructive purge.

## `maintenance`
Lazily constructs and executes only the existing calendar maintenance dependencies.

## `recovery`
Lazily constructs and executes only backup and retention dependencies.

## `temporaryRestore`
Lazily runs the injected preview restore engine, emits exactly the
`backup.restore` action plus closed evidence, and throws only a fixed
value-free failure.

## `runScheduledCalendarMaintenance`
Runs projection cleanup and repair before renewal, isolates all three operations, and reports a failure only after every maintenance path has been attempted.
## `cleanupProjectionRebuilds`
Invokes the owner-scoped database-only projection retention boundary before credential-dependent renewal; it never fetches events or reads OAuth tokens.
## `recordCredentialFailure`
Routes typed OAuth failure through the generation-safe maintenance checkpoint transition before rethrowing.
## `scheduled`
Uses Cloudflare's scheduled time and exact cron string for capability-separated dispatch.
## `createProductionTemporaryRestoreDependencies`
Imports the unchanged backup key, binds R2, and exposes target-only adapter
callbacks. It validates the fixed owner subject independently and never passes
the normal application database URL into restore creation, snapshot read-back,
or diagnostic read-back.
## `createTarget`
Constructs the interactive Neon adapter with the operator-known target ID,
preview environment, and disposable flag so the database-owned schema-9
attestation remains authoritative.
## `readTargetSnapshot`
Uses the canonical read-only repeatable-read migration-9 projection against
only the validated temporary target URL.
## `countReadableEvents`
Derives the normal opaque owner, restores wrapped keys from the temporary
target, exercises the diagnostic repository's owner authorization and title
decryption path, discards all returned rows immediately, and retains only a
nonnegative count.
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
