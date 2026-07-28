# `src/jobs/renew-google-channels.ts`

Renews expiring Google notification channels without interrupting a still-valid old channel.

## `renewExpiringChannels`
Renews every eligible connected calendar. Returns `completed` when renewal or
deferred channel cleanup was selected and `no_work` otherwise.
## `renewOne`
Pre-registers, watches, activates, stops, and retires in safe order.
## `assertDate`
Rejects invalid maintenance timestamps.
## `assertOpaqueSecret`
Requires bounded base64url channel credentials.
