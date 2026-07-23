# Token repository

Encrypts retained Google tokens, scopes them to one owner, and persists per-owner encryption keys.

## `get`

Reads one exact wrapped data key.

## `putIfAbsent`

Creates a wrapped data key once.

## `getActiveKeyVersion`

Reads the active encryption-key version.

## `activateKeyVersion`

Moves the active version forward without rollback.

## `find`

Reads one owner-and-subject token row.

## `upsert`

Atomically preserves an existing refresh token when Google omits one, or advances the version for a distinct provider token.

## `hasRefreshToken`

Reports whether an encrypted refresh token already exists.

## `getGoogleTokens`

Decrypts retained tokens for trusted server use.

## `saveGoogleTokens`

Encrypts provider tokens before the database call.

## `validateTokenWrite`

Checks token, subject, and timestamp bounds before encryption.

## `digestRefreshToken`

Creates a one-way equality marker so retries do not rotate ciphertext or version.

## `isValidDate`

Checks a real finite Date value.

## `tokenContext`

Binds token encryption to one owner-specific protected node.

## `validateScopes`

Validates the granted-scope metadata list.

## `parseScopes`

Parses stored scope metadata.

## `encodeEnvelope`

Serializes a token cipher envelope.

## `decodeEnvelope`

Validates a stored token cipher envelope.

## `decodeGoogleTokenRow`

Strictly reads one raw token row.

## `readText`

Reads bounded database text.

## `readBytes`

Reads canonical database bytea.

## `readPositiveInteger`

Reads positive version metadata.

## `readDigest`

Reads the canonical refresh-token equality marker.

## `readDate`

Reads a timezone-aware timestamp.

## `decodeWrappedKeyRow`

Strictly reads one wrapped data-key row.
