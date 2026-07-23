# `src/crypto/key-provider.ts`

This module gives each user and Vision domain a separate random data key. Data keys are encrypted, or “wrapped,” by the root Worker secret before a store can persist them.

`KeyProvider` returns a non-extractable key plus its version. `WrappedDataKeyStore` stores encrypted records and the authoritative active-version high-water mark, which may move forward but never backward.

## `getDataKey`

Without a version, reads one immutable store version and uses it for the whole operation. With a version, reads only that already-existing historical key.

## `rotateTo`

Atomically raises the store's active version without removing old wrapped keys.

## `createWrappedKeyProvider`

Imports the 256-bit Worker secret, atomically activates the configured version, and rejects stale configuration.

## `createWrappedDataKey`

Generates a random data key and immediately wraps it for one owner, domain, and version.

## `unwrapDataKey`

Authenticates a wrapped record and returns a non-extractable AES key.

## `validateWrappedDataKey`

Rejects unknown formats, algorithms, mismatched partitions, and wrong encoded sizes before base64 decoding.

## `encodeWrappingAad`

Binds the encrypted data key to its owner, domain, and version.

## `validateOwnerAndDomain`

Requires a non-empty owner and one of Vision's closed domains.

## `validateWrappingKey`

Requires a non-extractable 256-bit AES-GCM root key with wrapping permissions.
