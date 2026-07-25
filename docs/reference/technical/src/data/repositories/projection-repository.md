# `src/data/repositories/projection-repository.ts`

`EncryptedProjectionRepository` is the durable pre-activation half of invalid-token recovery. Generation rows bind
owner, provider calendar, job, base checkpoint version, and optional Queue claim. Stage rows use a SHA-256 identity
digest for deduplication, planning-only JSON, and an AES-256-GCM envelope bound to owner, generation, identity digest,
field name, domain partition, and key version.

`beginRebuild` never touches active events or the checkpoint. `stageChanges` validates every
`ProviderEventChange`, separates protected content before SQL, and uses a unique generation/identity key.
`markReady` is a one-way staging-to-ready transition. `loadStagedChanges` compares the authenticated envelope key
version with the row metadata, decrypts the payload, and parses the combined value through
`ProviderEventChangeSchema`. `abandon` retains crash evidence and ciphertext rows for bounded later cleanup.

Atomic projection/checkpoint/generation activation is intentionally owned by `SyncRepository`, where the Queue claim
and checkpoint compare-and-swap can guard all authoritative mutations in one PostgreSQL statement.

## `beginRebuild`

Validates the exact owner and authority tuple. An already-activated exact generation is reported without reset;
retryable pre-activation states can be recreated with cascading stage cleanup.

## `stageChanges`

Parses each closed change, derives its identity digest, stores planning JSON, and encrypts only an upsert's protected
payload. Generation status must still be `staging`.

## `markReady`

Compare-and-swaps the owner-bound generation from `staging` to `ready` with a positive page count.

## `loadStagedChanges`

Loads ready rows in ordinal order, authenticates row/envelope key-version agreement and AAD, then reparses the merged
planning/protected value.

## `abandon`

Transitions only `staging` or `ready` generations; it cannot rewrite activated history.

## `assertOwner`

Enforces the repository's construction-time owner before database or key access.

## `createProjectionRepository`

Composes the production database, key provider, and authenticated owner.

## `validateBegin`

Checks all bounded identifiers, positive checkpoint generation, and genuine timestamp.

## `digestIdentity`

SHA-256 hashes the canonical provider identity tuple and emits unpadded base64url.

## `stageContext`

Constructs the unresolved-domain protected-field AAD node identity for a generation row.

## `encodeEnvelope`

Uses the shared bounded serializer before UTF-8 storage.

## `decodeEnvelope`

Uses fatal UTF-8 decoding and the shared strict envelope parser.

## `readJsonObject`

Normalizes Neon text JSON or PGlite objects and rejects arrays, null, and invalid JSON.

## `readDigest`

Requires the exact 43-character canonical SHA-256 base64url shape.

## `readPositiveInteger`

Accepts safe positive integers from numeric or decimal database representations.

## `readBytes`

Copies binary values or decodes canonical lowercase hexadecimal `bytea` text.

## `requireBoundedText`

Implements the closed non-empty opaque-string boundary.
