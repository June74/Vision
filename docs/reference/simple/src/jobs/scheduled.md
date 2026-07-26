# `src/jobs/scheduled.ts`

Routes the 15-minute Google maintenance schedule and daily encrypted recovery schedule without mixing their
credentials.

## `runScheduledJob`
Calls only the function belonging to the exact configured cron expression.

## `runScheduledRecovery`
Creates and verifies today's backup before starting retention.

## `maintenance`
Builds Google maintenance capability only for the 15-minute cron.

## `recovery`
Builds backup capability only for the daily recovery cron.

## `runScheduledCalendarMaintenance`
Runs expired rebuild cleanup, queues repair, still attempts renewal if either fails, and reports a failure afterward.
## `cleanupProjectionRebuilds`
Removes expired encrypted rebuild staging before Google credentials are needed.
## `recordCredentialFailure`
Stores a safe credential failure before the scheduler reports it.
## `scheduled`
Connects Cloudflare scheduled events to exact cron routing.
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
