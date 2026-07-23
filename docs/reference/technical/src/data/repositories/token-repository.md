# Token repository

Refresh and retained access tokens are encrypted through `protected-fields.ts`; raw token rows contain bytea envelopes plus only queryable owner, Google subject, expiry, granted scopes, token version, and update time. The repository instance fixes the Vision owner so operations cannot substitute a different owner.

Wrapped per-owner/per-domain data keys are protected by the Worker root key. `data_key_state` is the monotonic rotation authority and `wrapped_data_keys` retains historical versions for decryption.

## Signatures

```ts
find(ownerId: string, googleSubject: string): Promise<GoogleTokenRow | undefined>;
upsert(row: GoogleTokenWriteRow): Promise<GoogleTokenRow>;
hasRefreshToken(googleSubject: string): Promise<boolean>;
getGoogleTokens(googleSubject: string): Promise<RetainedGoogleTokens | undefined>;
saveGoogleTokens(tokens: NewGoogleTokens): Promise<RetainedGoogleTokens>;
```

## Dependencies

Uses Drizzle parameterized SQL, Web Crypto SHA-256, protected-field encryption, the owner-bound key-provider port, and wrapped-key persistence.

## Inputs and outputs

The repository fixes `ownerId` at construction. Writes accept a subject, optional newly issued refresh token, optional access token, expiry, exact scopes, and update time. Reads return plaintext only inside the trusted server caller.

## Side effects

Writes encrypt provider values and execute one atomic PostgreSQL CTE. Reads select owner/subject metadata and decrypt only the returned ciphertext. Wrapped-key methods read, insert, or monotonically activate durable key versions.

## Failure behavior

Omission without an existing row, owner/subject mismatch, malformed metadata, overbound/noncanonical bytes, crypto failure, or SQL failure rejects with constant application errors. Provider-token plaintext and SQL detail are absent.

## Privacy and authorization

Refresh/access tokens are ciphertext; the SHA-256 refresh digest is only an equality marker for high-entropy tokens. Omission preserves the database envelope/version. A distinct provider digest replaces it and advances the version; an equal retry preserves both. Every token statement is owner-and-subject scoped.

## Covering tests

`tests/integration/data/auth-token-concurrency.test.ts` covers both completion orders, equal retry, owner isolation, versioning, and raw plaintext absence. `tests/contract/data/auth-row-bounds.contract.test.ts` covers binary bounds.

## `get`

Selects one `(owner_id, domain, key_version)` wrapped-key tuple.

## `putIfAbsent`

Uses `ON CONFLICT DO NOTHING`, then returns the inserted row or re-reads the authoritative conflict winner.

## `getActiveKeyVersion`

Reads the singleton `primary` rotation row.

## `activateKeyVersion`

Uses `greatest(current, candidate)` in one upsert and returns the authoritative version.

## `find`

Selects only the exact owner and Google subject with parameterized predicates.

## `upsert`

Uses an atomic update/insert CTE. Null refresh fields preserve the database winner; a distinct digest replaces ciphertext and increments `token_version`; equal retry preserves envelope and version.

## `hasRefreshToken`

Uses ciphertext presence only; it does not decrypt the token to decide consent behavior.

## `getGoogleTokens`

Validates owner/subject/version, decrypts refresh and optional access token with exact AAD, and parses scope metadata.

## `saveGoogleTokens`

Validates bounded inputs, encrypts supplied provider fields, hashes a supplied refresh token for equality only, persists atomically, then decrypts the authoritative returned row.

## `validateTokenWrite`

Bounds subject, optional provider tokens, and genuine Date inputs before cryptographic or database work.

## `digestRefreshToken`

Calculates canonical SHA-256 base64url for equality/idempotency; the high-entropy provider token itself remains encrypted.

## `isValidDate`

Uses the intrinsic Date getter to reject invalid or hostile date inputs.

## `tokenContext`

Returns stable owner, node, and `unresolved` domain AAD for provider credentials.

## `validateScopes`

Accepts 1-32 unique, whitespace-free, bounded strings and copies the list.

## `parseScopes`

Splits the queryable space-delimited database value and reuses the strict validator.

## `encodeEnvelope`

Requires a non-null envelope and serializes it as UTF-8 bytea.

## `decodeEnvelope`

Fatal-decodes and validates the cipher envelope before decrypting.

## `decodeGoogleTokenRow`

Strictly decodes aliased raw cells, canonical bytea, timestamps, and positive token version.

## `readText`

Rejects non-string, empty, and oversized database values.

## `readBytes`

Accepts only exact decoded `Uint8Array` values or canonical lowercase PostgreSQL bytea hex, applies the same shared nonzero maximum, and returns a mutation-independent copy.

## `readPositiveInteger`

Accepts a positive safe integer or canonical positive decimal text.

## `readDigest`

Requires exactly 43 canonical base64url characters for the SHA-256 equality marker.

## `readDate`

Accepts a valid Date or explicitly timezone-aware timestamp string.

## `decodeWrappedKeyRow`

Reconstructs the fixed A256GCM version-1 wrapped-key record and validates its domain and metadata bounds.
