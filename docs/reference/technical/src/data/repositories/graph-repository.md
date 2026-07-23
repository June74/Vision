# `src/data/repositories/graph-repository.ts`

The repository translates pure domain types at the database boundary. It uses Neon HTTP statements and an atomic non-interactive transaction for edge replacement.

## `upsertNode`

Uses `(ownerId, provider, providerNodeId)` as the upsert target. The update predicate also requires the same owner and stable node ID before accepting a newer version; a global-ID collision with another owner remains a database integrity failure.

## `upsertEvent`

Uses the globally unique provider event identity only as a conflict locator. Its update predicate requires the existing `owner_id` to equal the incoming owner, and conflict updates deliberately never set `owner_id`. A pre-existing same-owner `event` node must be persisted through `upsertNode` before this call.

## `replaceEdges`

Deletes existing source-owner edges then inserts replacements in one transaction.

## `getEventByProviderIdentity`

Selects only the planning-safe event and node columns used by `VisionEvent`; protected ciphertext envelopes never enter this query result.
