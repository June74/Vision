# `src/data/repositories/sync-repository.ts`

The synchronization repository separates owner-scoped encryption from a ciphertext-only atomic store. Provider content
is encrypted before the database adapter is reachable. Full protected mapper payloads, including attachment references
and all meeting links, are stored in `event_sync_payloads`; existing per-field envelopes remain available to the normal
event repository.

`DrizzleAtomicSyncStore.applyAtomic` uses one PostgreSQL statement. A versioned checkpoint update is the gate consumed
by every data-changing CTE. If compare-and-swap or metadata context validation fails, no event CTE can produce a row.
Any later SQL error rolls back the checkpoint, events, tombstones, derived invalidations, and safe run record together.

## `loadCheckpoint`

In the store, inserts a version-zero row with null token/key fields and then returns one owner/provider/calendar row. In
the encrypted repository, version zero maps to no checkpoint; positive versions require and decrypt an envelope under
exact owner/calendar AAD.

## `loadProjectionContexts`

Selects no protected columns. It supplies stable node ID, category, category state, privacy, and node version so event
encryption preserves Vision-owned metadata.

## `applyAtomic`

Parses ciphertext-only staged JSON with `jsonb_to_recordset`, validates the pre-encryption node snapshots, performs the
checkpoint CAS, applies only newer provider upserts, applies unversioned tombstones without inventing an order, retains
encrypted deleted rows for 30 days, retracts model-derived edges, and inserts `sync_runs` safe counts. The final select
returns counts only.

## `recordFailure`

Writes status and a fixed error category while leaving token envelope, key version, committed time, and CAS version
unchanged.

## `applyChanges`

Loads planning contexts, prepares each upsert sequentially to bound crypto concurrency, encrypts the complete provider
payload and terminal sync token, and makes one atomic store call.

## `prepareUpsert`

Converts an `UpsertEvent` to a `PlaintextEvent`. Existing category/privacy/node version are retained; new events start
with unresolved category, private privacy, and version one. It stores the first meeting link in the legacy field and
the complete protected mapper payload in its own envelope.

## `assertOwner`

Enforces the authenticated owner captured by repository construction on every public operation.

## `createSyncRepository`

Composes `DrizzleAtomicSyncStore`, key provider, and authenticated owner.

## `createSyncRepositoryWithStore`

Exposes the same owner-scoped encryption composition for deterministic atomic-store tests.

## `preparedUpsertToDatabase`

Removes all plaintext protected values and encodes only cipher bytes plus planning-safe fields for SQL transport.

## `stableEventNodeId`

SHA-256 hashes a versioned tuple of owner, calendar, and event identity, then returns a base64url opaque ID.

## `providerNodeIdentity`

Serializes the calendar/event tuple for the normalized provider node identity column.

## `checkpointContext`

Uses the unresolved data-key partition and a calendar-bound synthetic node ID for cursor AAD.

## `checkpointId`

Builds the queryable row ID from already-queryable provider identity fields.

## `encodeEnvelope`

Validates through the shared serializer and UTF-8 encodes the cipher envelope.

## `decodeEnvelope`

Uses fatal UTF-8 decoding and the bounded shared parser after owner-scoped row selection.

## `bytesToHex`

Copies ciphertext into lowercase hexadecimal text for the transient parameter only; PostgreSQL decodes it to `bytea`.

## `decodeCheckpointRow`

Strictly validates owner/calendar, nullable envelope/key consistency inputs, timestamp, and nonnegative CAS version.

## `decodeProjectionContext`

Validates the planning category, category state, privacy, node identity, and positive version returned by PostgreSQL.

## `readText`

Rejects missing, empty, and non-string raw database text.

## `readNonNegativeInteger`

Accepts only safe integers or canonical unsigned decimal text.

## `readPositiveInteger`

Reuses the nonnegative parser and rejects zero.

## `readDate`

Accepts a genuine Date or an offset-bearing timestamp string and copies it.

## `readBytes`

Copies driver bytes or decodes canonical lowercase PostgreSQL `bytea` hexadecimal text.
