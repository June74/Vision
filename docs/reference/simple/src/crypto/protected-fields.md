# `src/crypto/protected-fields.ts`

This module encrypts a whole protected object one string field at a time. Null fields remain null. Every encrypted value is tied to its own field name, so moving a title envelope into a description field fails.

`ProtectedObjectContext` contains the owner, graph node, and domain. `EncryptedProtectedFields<T>` keeps the same keys as the plaintext object.
Each non-null string must fit the envelope module's 64 KiB UTF-8 limit.

## `encryptProtectedFields`

Uses one active per-user/per-domain key version to encrypt all non-null string fields.

## `decryptProtectedFields`

Loads the exact historical key version in each envelope and restores strings only when every context binding authenticates.

## `validateProtectedObjectContext`

Requires non-empty owner and node IDs plus a closed Vision domain.

## `validatePlainProtectedFields`

Accepts an object containing only string or null protected values.

## `validateFieldName`

Rejects an empty field name before it can become authenticated metadata.
