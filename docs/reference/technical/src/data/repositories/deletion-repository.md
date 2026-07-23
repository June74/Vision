# `src/data/repositories/deletion-repository.ts`

The Drizzle adapter uses data-modifying PostgreSQL CTEs, so each lifecycle operation has one authoritative statement rather than partially committed client-side steps. It never decrypts, serializes, or rewrites protected event fields.

## `markDeleted`

**Signature:** `(nodeId, deletedAt, purgeAfter?) => Promise<RecoverableDeletion>`.

Validates the pure 30-day contract, changes only an active node to `deleted`, increments its version, and inserts `recoverable_deletions` in the same statement. A missing or non-active node raises `DeletionStateConflictError`.

## `restoreDeleted`

**Signature:** `(nodeId, now) => Promise<boolean>`.

Updates a matching deleted node to `active` only when `now < purge_after`, then removes its recovery marker. It does not select or update event envelope columns.

## `purgeExpiredDeletions`

**Signature:** `(now) => Promise<{ purgedNodeIds: string[] }>`.

For rows where `purge_after <= now`, one CTE detaches historical audit rows from deleted nodes, removes connected edges, events and their ciphertext, recovery records, and nodes, then writes a closed `record.purged` audit fact with no node reference. Its audit ID uses PostgreSQL `md5` of the opaque node ID, so the raw node identifier is not copied into retained audit data. A second run sees no recovery row and returns an empty list.

## `createDeletionRepository`

**Signature:** `(database) => DeletionRepository`.

Returns the server-only Drizzle adapter. Authentication and request authorization remain outside this lifecycle foundation.

## `createRestoreRequest`

Internal input normalizer that reuses the pure date/ID validation contract before SQL construction.

## `createPurgeRequest`

Internal input normalizer that validates the scheduler-provided UTC instant without accepting protected values.

## `decodePurgedNodeId`

Internal strict decoder for the single opaque `nodeId` SQL projection; it does not coerce database values.
