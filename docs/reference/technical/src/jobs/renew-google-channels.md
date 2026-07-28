# `src/jobs/renew-google-channels.ts`

The lifecycle coordinator handles Google's possible initial `sync` callback before `events.watch` returns. It stores the token digest and encrypted recovery envelope before the external call, activates the returned resource atomically, and only then stops the old exact channel/resource pair.

## `renewExpiringChannels`
Processes repository-selected private connected calendars independently and
then retries exact deferred channel cleanup. It returns `completed` when
either repository selection contained work and `no_work` only when both were
empty.
## `renewOne`
Generates high-entropy credentials, pre-registers pending verification, accepts an identical early-bound resource, activates before old-channel stop, preserves the old channel on watch failure, and exposes prolonged or expired failures as Action required.
## `assertDate`
Prevents invalid scheduler time from entering expiry comparisons.
## `assertOpaqueSecret`
Enforces length and base64url bounds without copying secrets into errors.
