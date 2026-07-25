# `src/jobs/scheduled.ts`

Runs Google channel renewal and missed-notification repair every 15 minutes.

## `runScheduledCalendarMaintenance`
Runs expired rebuild cleanup, queues repair, still attempts renewal if either fails, and reports a failure afterward.
## `cleanupProjectionRebuilds`
Removes expired encrypted rebuild staging before Google credentials are needed.
## `recordCredentialFailure`
Stores a safe credential failure before the scheduler reports it.
## `scheduled`
Connects Cloudflare scheduled events to maintenance.
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
