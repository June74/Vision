# `src/crypto/key-provider.ts`

This module gives each user and Vision domain a separate random data key. Data keys are encrypted, or “wrapped,” by the root Worker secret before a store can persist them.

`KeyProvider` returns a non-extractable key plus its version. `WrappedDataKeyStore` is the future database adapter contract, and `WrappedDataKeyRecord` contains only encrypted key material.

## `getDataKey`

Without a version, returns or creates the active encryption key. With a version, reads only that already-existing historical key.

## `rotateTo`

Moves future encryption to a newer key version without removing old wrapped keys.

## `createWrappedKeyProvider`

Imports the 256-bit Worker secret as a non-extractable root key and creates the provider.

## `createWrappedDataKey`

Generates a random data key and immediately wraps it for one owner, domain, and version.

## `unwrapDataKey`

Authenticates a wrapped record and returns a non-extractable AES key.

## `validateWrappedDataKey`

Rejects unknown formats, algorithms, mismatched partitions, and malformed binary values.

## `encodeWrappingAad`

Binds the encrypted data key to its owner, domain, and version.

## `validateOwnerAndDomain`

Requires a non-empty owner and one of Vision's closed domains.

## `validateWrappingKey`

Requires a non-extractable 256-bit AES-GCM root key with wrapping permissions.
