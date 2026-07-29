# `src/jobs/scheduled.ts`

## `createWithWriter`

Lets the temporary preview upload check replace only the final storage writer;
normal recovery keeps its ordinary writer.

## `runR2Upload`

Builds the normal backup path only after the preview fault binding has been
accepted.

Routes the 15-minute Google maintenance schedule and daily encrypted recovery
schedule. A generated preview candidate may add the one-minute route for
exactly one role probe, foundation probe, AI usage record, or strict fault
scenario without mixing their credentials or database targets.

## `runScheduledJob`
Calls only the function belonging to one of the three exact configured cron
expressions.

## `runScheduledRecovery`
Creates and verifies today's backup before starting retention.

## `maintenance`
Builds Google maintenance capability only for the 15-minute cron.

## `recovery`
Builds backup capability only for the daily recovery cron.

## `temporaryRoleProbe`
Builds only the preview read adapter, logs the fixed role-probe evidence, and
reports failure with one fixed message.

## `foundationProbe`

Runs only for the exact generated `foundation_probe` selector.

## `aiUsageEvidence`

Runs only for the exact generated `ai_usage` selector after its same-run
Gateway attestation is admitted.

## `createScheduledPhaseBAiUsageEvidenceDependencies`

Builds the owner-scoped usage, status, and calendar read set only from a true
already-verified Gateway boolean.

## `createProductionScheduledPhaseBAiUsageEvidenceDependencies`

Keeps production composition preview-only, derives the existing private owner
key, and constructs no Google or AI provider client.

## `runProductionScheduledPhaseBFoundationProbe`

Builds one max-one database pool, read-only R2 boundary, existing privilege
manifest, owner key, and controlled-title decryptor for the foundation
candidate.

## `connect`

Reserves the foundation probe's one database client.

## `query`

Returns only query rows through the probe's parameterized read port.

## `release`

Returns the retained client to the foundation probe pool.

## `end`

Closes the dedicated foundation probe pool.

## `decryptControlledTitle`

Decrypts only the controlled sentinel title and returns mutable bytes for
caller cleanup.

## `runScheduledPhaseBAiUsageEvidence`

Runs the three reads, emits exactly one fixed terminal record, and reports a
failed record only through one fixed error.

## `emitTemporaryPreviewRoleProbeEvidence`
Preserves the exact
`{ action: "backup.restore-role-probe", evidence }` log shape.

## `runScheduledCalendarMaintenance`
Runs expired rebuild cleanup, queues repair, still attempts renewal if either
fails, emits one fixed five-field maintenance result, and then reports the
original failure in cleanup, repair, renewal order.
## `cleanupProjectionRebuilds`
Removes expired encrypted rebuild staging before Google credentials are needed.
## `recordCredentialFailure`
Stores a safe credential failure before the scheduler reports it.
## `scheduled`
Connects Cloudflare scheduled events to exact cron routing. The one-minute
schedule requires exactly one admitted selector or the explicit role-probe
binding; missing or invalid candidate configuration cannot fall through.
## `createProductionScheduledEntryDependencies`
Builds lazy closures for each isolated scheduled capability without opening
one before the cron and candidate have been selected.
## `temporaryFaultR2Upload`
Runs the admitted R2 candidate through normal backup reads and encryption while
replacing only the final object writer.
## `writeTemporaryFaultEvidence`
Writes only the exact action and four-key preview-fault evidence record.
## `createProductionTemporaryRoleProbeDependencies`
Builds only the max-one read adapter required by the temporary role probe.
## `probeRole`
Opens, reads, and closes only the temporary max-one role-probe adapter.
## `createProductionScheduledRecoveryDependencies`
Builds the separate backup key, R2 store, and consistent Neon snapshot source.
## `create`
Creates and verifies today's encrypted object.
## `purge`
Applies the fixed 30-day retention rule after successful creation.
## `createProductionScheduledCalendarMaintenanceDependencies`
Builds owner-bound database, encryption, Google, and Queue dependencies.
## `verify`
Rejects ID-token verification in the refresh-only client.
## `renew`
Runs channel lifecycle maintenance.
## `watch`
Starts the exact Google watch channel.
## `stop`
Stops the exact old channel.
## `createChannelId`
Creates an opaque channel identifier.
## `createChannelToken`
Creates a secret callback token.
## `createLeaseId`
Creates an opaque renewal-election identifier.
## `encryptToken`
Encrypts the recovery copy of the token.
## `repair`
Reserves stale-calendar repair work.
## `resolveScheduledGoogleAccessToken`
Refreshes the scheduled Google credential only when channel work needs it.
## `refreshAccessToken`
Calls the refresh-only Google OAuth operation.
## `now`
Keeps one stable time across token expiry and refresh persistence checks.
## `randomOpaque`
Creates canonical random base64url text.
## `sha256Base64Url`
Hashes channel tokens and owner identifiers.
## `deriveOwnerId`
Derives the authentication-compatible owner key.
## `readScheduledOwnerSubject`
Admits the existing bounded owner subject without copying it to an error.
