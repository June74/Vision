# Session repository

Hashes browser bearers and encrypts OAuth verifier, nonce, session email, and CSRF values before storage.

## `insertOAuthTransaction`

Stores only a state hash and encrypted protocol values.

## `consumeOAuthTransaction`

Atomically marks one unexpired OAuth transaction used.

## `insertSession`

Stores one hashed session ID with encrypted browser-facing fields.

## `findSession`

Finds only an active, unrevoked session.

## `revokeSession`

Revokes one hashed session.

## `createOAuthTransaction`

Encrypts a new short-lived state transaction before persistence.

## `createSession`

Encrypts a new session before persistence.

## `hashOpaqueSecret`

Hashes an opaque state or session value for lookup.

## `encodeBase64Url`

Encodes digest bytes for a canonical lookup key.

## `encodeEnvelope`

Serializes an encrypted field into database bytes.

## `decodeEnvelope`

Validates encrypted bytes before decryption.

## `decodeOAuthTransactionRow`

Strictly reads one raw OAuth transaction row.

## `decodeServerSessionRow`

Strictly reads one raw session row.

## `readDatabaseText`

Reads bounded non-empty database text.

## `readDatabaseBytes`

Reads canonical PostgreSQL bytea.

## `readDatabaseDate`

Reads a valid timezone-aware timestamp.
