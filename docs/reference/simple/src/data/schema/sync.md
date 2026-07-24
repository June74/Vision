# `src/data/schema/sync.ts`

These tables keep provider sync position, encrypted mapped-event payloads, content-free run metrics, notification
channels, and deletion recovery state.

## `syncCheckpoints`

Stores a version-zero empty cursor or a positive compare-and-swap version with its encrypted token, plus safe connection
status.

## `eventSyncPayloads`

Stores the complete mapped protected Google payload as binary ciphertext.

## `syncRuns`

Stores only opaque IDs, reason, counts, timing, and checkpoint version for diagnostics.

## `syncChannels`

Stores provider channel details and an encrypted verification token.

## `recoverableDeletions`

Stores the encrypted recovery window for a deleted node.
