# `src/data/schema/sync.ts`

Synchronization uses explicit provider/calendar/channel columns and `bytea` ciphertext envelopes, never JSON tokens.
Recovery records preserve the exact deletion and purge boundary.

## `syncCheckpoints`

Defines the owner/provider/calendar checkpoint and its encrypted token. Version zero requires null token/key fields;
positive compare-and-swap versions require both. Closed status and error-category fields contain no provider message.

## `eventSyncPayloads`

Defines an owner-consistent event foreign key, complete protected payload envelope, and positive key version.

## `syncRuns`

Defines content-free synchronization diagnostics. Count, page, checkpoint, and timestamp constraints prevent invalid
operation records.

## `syncChannels`

Defines renewable provider channel identity and protected verification state.

## `recoverableDeletions`

Defines same-owner deleted-node recovery metadata and optional encrypted recovery material.
