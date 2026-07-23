# `src/data/repositories/graph-repository.ts`

The repository translates pure domain types at the database boundary. Each upsert is one atomic PostgreSQL
statement suitable for Neon HTTP's non-interactive execution model. Edge replacement uses an atomic
non-interactive transaction.

## `upsertNode`

Uses `(ownerId, provider, providerNodeId)` as the conflict target. One `WITH ... INSERT ... ON CONFLICT ...
RETURNING` statement conditionally advances mutable fields only when the returned row has the same stable node ID
and a lower version. Owner and stable-ID columns are never assigned during conflict resolution.

The result is `applied` when the persisted row represents the requested version, including an idempotent replay,
or `no_newer_version` when a later version already exists. A returned owner, stable-ID, or natural-identity
mismatch throws `GraphIdentityConflictError`. PostgreSQL unique code `23505`, including a global node-ID race, is
translated to the same constant, privacy-safe error without exposing SQL parameters, provider IDs, URLs, or
protected content.

## `upsertEvent`

Uses the globally unique provider event identity only as a conflict locator. The single atomic statement advances
planning-safe fields only when owner and stable node ID match and the existing provider version sorts before the
incoming provider version. Conflict updates never assign `owner_id` or `node_id`. Provider adapters must therefore
supply non-empty `sourceVersion` tokens whose PostgreSQL text order matches the provider's change order; equal
tokens are idempotent replays and lower tokens cannot overwrite newer state.

A pre-existing same-owner `event` node must be persisted through `upsertNode` before this call. The return semantics
and privacy-safe identity-conflict handling match `upsertNode`.

## `classifyAtomicUpsertResult`

Purely compares the one statement's returned persisted identity and version relation with the requested identity.
It returns `applied` or `no_newer_version`, throws `GraphIdentityConflictError` for owner/stable/natural identity
collisions, and rejects missing or structurally invalid database results. It performs no database access.

## `translateUniqueViolation`

Inspects only the PostgreSQL error code and one wrapped cause. Code `23505` becomes a constant-message
`GraphIdentityConflictError`; every other error is rethrown unchanged. Raw database messages are never copied into
the identity-conflict error.

## `replaceEdges`

Deletes existing source-owner edges then inserts replacements in one transaction.

## `getEventByProviderIdentity`

Selects only the planning-safe event and node columns used by `VisionEvent`; protected ciphertext envelopes never
enter this query result.
