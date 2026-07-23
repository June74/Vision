# Token repository

Refresh and retained access tokens are encrypted through `protected-fields.ts`; raw token rows contain bytea envelopes plus only queryable owner, Google subject, expiry, granted scopes, token version, and update time. The repository instance fixes the Vision owner so operations cannot substitute a different owner.

Wrapped per-owner/per-domain data keys are protected by the Worker root key. `data_key_state` is the monotonic rotation authority and `wrapped_data_keys` retains historical versions for decryption.

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

Conflicts on owner, permits update only when the subject is unchanged, replaces ciphertext, and increments `token_version` atomically.

## `hasRefreshToken`

Uses ciphertext presence only; it does not decrypt the token to decide consent behavior.

## `getGoogleTokens`

Validates owner/subject/version, decrypts refresh and optional access token with exact AAD, and parses scope metadata.

## `saveGoogleTokens`

Snapshots scopes, encrypts both provider token fields, and verifies the returned row remains owner/subject bound.

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

Copies decoded bytes or parses bounded lowercase canonical PostgreSQL bytea hex.

## `readPositiveInteger`

Accepts a positive safe integer or canonical positive decimal text.

## `readDate`

Accepts a valid Date or explicitly timezone-aware timestamp string.

## `decodeWrappedKeyRow`

Reconstructs the fixed A256GCM version-1 wrapped-key record and validates its domain and metadata bounds.
