# `src/data/schema/sync.ts`

Synchronization uses explicit provider/calendar/channel columns and `bytea` ciphertext envelopes, never JSON tokens. Recovery records preserve the exact deletion and purge boundary.

## `syncCheckpoints`

Defines the owner/provider/calendar checkpoint and its encrypted token.

## `syncChannels`

Defines renewable provider channel identity and protected verification state.

## `recoverableDeletions`

Defines same-owner deleted-node recovery metadata and optional encrypted recovery material.
