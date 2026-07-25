# `src/jobs/scheduled.ts`

The scheduled entry point performs lifecycle control and only reserves event synchronization through the normal opaque Queue. Credentials and provider content never enter a job.

## `runScheduledCalendarMaintenance`
Runs repair before renewal, isolates their execution, and reports a failure only after both maintenance paths have been attempted.
## `scheduled`
Uses Cloudflare's scheduled time and awaits maintenance.
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
## `randomOpaque`
Encodes random bytes as canonical base64url.
## `sha256Base64Url`
Produces a fixed-size digest.
## `deriveOwnerId`
Matches authentication's opaque owner derivation.
