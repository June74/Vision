# `src/data/repositories/sync-repository.ts`

This repository encrypts Google event content and sync tokens before one atomic PostgreSQL commit. Existing Vision
category and privacy facts are retained.

## `loadCheckpoint`

Creates or reads a version-zero cursor row, then decrypts a committed token only for the repository owner.
Queue-backed reads create or return that row only while the exact durable job claim is still active.

## `loadProjectionContexts`

Reads planning-only node category, privacy, provenance, model confidence, and version facts for one owner and calendar.
Those facts are carried without weakening model or explicit user authority.

## `applyAtomic`

Uses one checkpoint compare-and-swap SQL statement to apply events, tombstones, derived invalidations, safe metrics, and
the terminal encrypted token. Existing event nodes and event rows are locked in stable node order before the checkpoint
is admitted. If a category correction wins first, synchronization returns a conflict without advancing the cursor or
recording a successful run. Queue commits also require the exact active job claim before any mutation.

For a full rebuild, the same statement also verifies the ready generation, tombstones provider identities absent from
the full listing, revives recoverable equal-version events, activates the generation, and clears its stage rows.

## `recordFailure`

Updates safe health classification without modifying the cursor or its version.

## `applyChanges`

Encrypts staged event fields and the terminal token before calling atomic storage.

## `prepareUpsert`

Preserves existing Vision metadata, including provenance and model confidence, or creates unresolved private defaults
for a new provider event.

## `assertOwner`

Rejects cross-owner repository use.

## `createSyncRepository`

Builds the production encrypted repository over the Neon database adapter.

## `createSyncRepositoryWithStore`

Builds the same encrypted boundary over an injected atomic store for tests.

## `preparedUpsertToDatabase`

Converts encrypted binary fields to the ciphertext-only transaction transport.

## `stableEventNodeId`

Hashes owner and provider identity into one deterministic opaque node ID.

## `providerNodeIdentity`

Creates the queryable calendar/event identity stored on the node.

## `checkpointContext`

Binds cursor encryption to the owner and calendar.

## `checkpointId`

Creates the non-secret durable checkpoint row ID.

## `encodeEnvelope`

Serializes a validated cipher envelope to bytes.

## `decodeEnvelope`

Parses a stored binary cipher envelope.

## `bytesToHex`

Encodes ciphertext for transient JSON-to-recordset SQL transport.

## `decodeCheckpointRow`

Strictly parses one raw checkpoint row.

## `decodeProjectionContext`

Strictly parses category authority and rejects an inferred state without a valid model confidence.

## `readText`

Reads one required text cell.

## `readNonNegativeInteger`

Reads a strict nonnegative integer cell.

## `readPositiveInteger`

Reads a strict positive integer cell.

## `readDate`

Reads a timezone-aware timestamp.

## `readBytes`

Reads canonical PostgreSQL binary data.
