# Session repository

The high-level repository uses `protected-fields.ts` with `unresolved` privacy-domain keys. OAuth rows bind Additional Authenticated Data (AAD) to the state hash; session rows bind it to the session hash and owner. The Drizzle store uses parameterized statements, and consumption is an update-with-returning operation whose `consumed_at is null` predicate is the replay linearization point.

## `insertOAuthTransaction`

Inserts `state_hash`, verifier/nonce bytea envelopes, creation, and expiry; plaintext state, verifier, and nonce are absent.

## `consumeOAuthTransaction`

Performs one `UPDATE ... WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ? RETURNING ...` statement.

## `insertSession`

Inserts a SHA-256 session hash, owner/subject metadata, encrypted email/CSRF fields, and bounded lifetime.

## `findSession`

Selects by session hash with `revoked_at IS NULL` and future expiry.

## `revokeSession`

Sets `revoked_at` only on a still-active matching hash and returns whether a row changed.

## `createOAuthTransaction`

Hashes state, encrypts verifier and nonce, and calls the store only after both envelopes exist.

## `createSession`

Hashes the bearer and encrypts email and CSRF under owner/session AAD before insert.

## `hashOpaqueSecret`

Requires a 32-256 character opaque value, calculates SHA-256 with Web Crypto, and returns unpadded base64url.

## `encodeBase64Url`

Produces the canonical unpadded digest representation.

## `encodeEnvelope`

Requires a non-null validated cipher envelope and UTF-8 serializes it for bytea.

## `decodeEnvelope`

Fatal-decodes UTF-8 and revalidates the serialized cipher envelope.

## `decodeOAuthTransactionRow`

Decodes exact aliases, canonical bytea, and timestamps into the store contract.

## `decodeServerSessionRow`

Decodes exact session columns without coercing owner, subject, or encrypted fields.

## `readDatabaseText`

Rejects non-string, empty, and oversized cells with a constant persistence error.

## `readDatabaseBytes`

Copies `Uint8Array` values or decodes lowercase canonical `\x` bytea hex within a size bound.

## `readDatabaseDate`

Copies valid Date instances or parses strings that explicitly carry `Z` or an offset.
