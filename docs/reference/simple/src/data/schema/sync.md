# `src/data/schema/sync.ts`

These tables keep provider sync position, notification channels, and deletion recovery state.

## `syncCheckpoints`

Stores the last encrypted sync token for one provider calendar.

## `syncChannels`

Stores provider channel details and an encrypted verification token.

## `recoverableDeletions`

Stores the encrypted recovery window for a deleted node.
