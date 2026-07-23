# `src/crypto/protected-fields.ts`

This module adapts generic protected objects to the field envelope API. `ProtectedObjectContext` supplies `{ ownerId; nodeId; domain }`; field names come from the object. `PlainProtectedFields` permits only strings and nulls, and `EncryptedProtectedFields<T>` preserves the same keys with envelope-or-null values.

`tests/unit/crypto/protected-fields.test.ts` covers sentinel absence, nullable behavior, field swapping, wrong node/owner/domain, data-key separation, key rotation, unknown versions, invalid value types, and the test-provider production guard.

## `encryptProtectedFields`

**Signature:** `<T extends PlainProtectedFields>(keyProvider: KeyProvider, context: ProtectedObjectContext, fields: T) => Promise<EncryptedProtectedFields<T>>`

Validates the complete input before a key lookup. If any string exists, it resolves the provider's active key once and independently encrypts each string with field-specific AAD and a fresh IV. Null-only objects do not create a key. It does not serialize arbitrary objects or log plaintext.

## `decryptProtectedFields`

**Signature:** `<T extends PlainProtectedFields>(keyProvider: KeyProvider, context: ProtectedObjectContext, fields: EncryptedProtectedFields<T>) => Promise<T>`

Strictly validates each envelope before reading its `keyVersion`, caches exact historical key lookups by version, then decrypts with owner/node/field/version AAD. An explicit provider version never creates a missing record. Any invalid envelope or authentication failure rejects the whole operation.

## `validateProtectedObjectContext`

**Signature:** `(context: ProtectedObjectContext) => void`

Requires a non-null object, non-empty owner and node IDs, and a domain accepted by `DomainSchema`. It runs before encryption or decryption key access.

## `validatePlainProtectedFields`

**Signature:** `(fields: PlainProtectedFields) => Array<[string, string | null]>`

Rejects null, arrays, and non-object inputs; validates each own field name and permits only a string or null value. No implicit JSON serialization or coercion can move complex data across the privacy boundary.

## `validateFieldName`

**Signature:** `(fieldName: string) => void`

Rejects empty property names so every envelope has a meaningful field AAD binding.
