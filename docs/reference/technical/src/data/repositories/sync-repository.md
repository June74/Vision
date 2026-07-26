# `src/data/repositories/sync-repository.ts`

The synchronization repository separates owner-scoped encryption from a ciphertext-only atomic store. Provider content
is encrypted before the database adapter is reachable. Full protected mapper payloads, including attachment references
and all meeting links, are stored in `event_sync_payloads`; existing per-field envelopes remain available to the normal
event repository.

`DrizzleAtomicSyncStore.applyAtomic` uses one PostgreSQL statement. Existing nodes are locked in deterministic node-ID
order, then their event rows are locked in the same order. The post-wait rows must still match the exact category
authority snapshot before a checkpoint row can be guarded. Provider writes and dependent cleanup complete before the
checkpoint update and safe run record are reachable. If compare-and-swap or metadata context validation fails, no event
CTE can produce a row. Any later SQL error rolls back events, tombstones, derived invalidations, checkpoint, and safe run
record together.

## `loadCheckpoint`

In the store, inserts a version-zero row with null token/key fields and then returns one owner/provider/calendar row. In
the encrypted repository, version zero maps to no checkpoint; positive versions require and decrypt an envelope under
exact owner/calendar AAD. Queue-backed loads first lock and verify the exact job, owner, calendar, original queue-job
reason, status, and claim ID, so an already-superseded worker cannot create even the version-zero row. A rebuild can
therefore record its sync run with reason `rebuild` while still proving authority from the job's original reason.

## `loadProjectionContexts`

Selects no protected columns. It supplies stable node ID, category, category state, privacy, provenance, model
confidence, and node version so event encryption preserves Vision-owned metadata and never proposes an invalid inferred
node during `INSERT ... ON CONFLICT`.

## `applyAtomic`

Parses ciphertext-only staged JSON with `jsonb_to_recordset`, locks and validates the pre-encryption node snapshots,
guards the expected checkpoint row, applies only newer provider upserts, applies unversioned tombstones without
inventing an order, retains encrypted deleted rows for 30 days, retracts model-derived edges, then advances the
checkpoint and inserts `sync_runs` safe counts. The final select returns counts only. Queue commits materialize and lock
the exact active job claim before the checkpoint guard. Provider-newer writes must produce matching event and payload
rows before the terminal checkpoint update is admitted. The failure transition uses the same job-then-checkpoint lock
order.

The node-then-event ordering is shared with category correction. If correction holds the node lock, synchronization
waits and re-evaluates the current row after correction commits. A changed category/version makes the sync statement
return conflict; its encrypted cursor and run row remain untouched. If synchronization wins the node lock, correction
retries from the newer provider ciphertext before changing the category.

When `replaceProjection` is bound to a ready rebuild generation, an additional materialized lock verifies its owner,
calendar, job, base checkpoint version, and Queue claim. Provider identities absent from the complete incoming set
become recoverable tombstones; deterministic IDs preserve annotations, category assignments, and user edges.
Equal-version upserts may revive only an already-cancelled/deleted record. Generation activation, stage cleanup,
checkpoint advancement, projection mutation, and the safe run row remain one atomic statement.

## `recordFailure`

Writes status and a fixed error category while leaving token envelope, key version, committed time, and CAS version
unchanged.

## `applyChanges`

Loads planning contexts, prepares each upsert sequentially to bound crypto concurrency, encrypts the complete provider
payload and terminal sync token, and makes one atomic store call.

## `prepareUpsert`

Converts an `UpsertEvent` to a `PlaintextEvent`. Existing category/privacy/node version, provenance, and model confidence
are retained; new events start with unresolved category, provider provenance, private privacy, null confidence, and
version one. It stores the first meeting link in the legacy field and the complete protected mapper payload in its own
envelope.

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

Validates category, category state, privacy, provenance, model-confidence consistency, node identity, and positive
version returned by PostgreSQL.

## Multi-session acceptance gate

`tests/integration/jobs/sync-correction-postgresql-concurrency.test.ts` is an opt-in real PostgreSQL harness for the
post-snapshot lock-wait schedule that a single PGlite backend cannot reproduce. It creates and removes only a randomized
`vision_sync_race_*` schema. Run it only against an explicitly approved disposable database by setting
`VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL` and `VISION_SYNC_CONCURRENCY_TEST_APPROVED=true`. The normal suite keeps it
skipped. The disposable test role must be allowed to create and drop that isolated schema. The harness does not use the
preview `DATABASE_URL`, and it must never be pointed at preview or production.

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
