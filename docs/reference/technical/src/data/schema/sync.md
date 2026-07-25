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

## `projectionRebuildGenerations`

Defines the owner/calendar/job/base-checkpoint lifecycle for durable full-list staging. The optional Queue claim binds
activation authority, while status/timestamp checks keep abandoned and activated states distinguishable for cleanup.

## `projectionRebuildChanges`

Defines generation-scoped identity-digest deduplication and page order. Planning JSON contains no provider protected
content; an optional payload envelope and matching positive key version carry protected upsert fields. The cascading
generation foreign key permits bounded cleanup without touching authoritative nodes.
