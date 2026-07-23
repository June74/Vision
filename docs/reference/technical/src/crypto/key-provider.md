# `src/crypto/key-provider.ts`

This module implements envelope encryption for data keys. `KeyProvider.getDataKey(ownerId, domain, keyVersion?)` returns `VersionedDataKey`. `WrappedDataKeyStore` supplies `get` and atomic `putIfAbsent`; persistence contains only `WrappedDataKeyRecord`, never the root key or a plaintext data key.

The active path may generate a missing random 256-bit key. An explicit version is a read-only historical lookup and fails if absent, preventing decryption under a wrong context from creating key state. Concurrent active-key creation uses `putIfAbsent` and unwraps whichever record won.

`tests/unit/crypto/protected-fields.test.ts` covers owner/domain separation, unknown versions, and old-key decryption after active rotation.

## `getDataKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion?: number) => Promise<VersionedDataKey>`

Validates the key partition. With `keyVersion`, it fetches and authenticates exactly that stored version. Without it, it fetches the active record or generates and atomically stores a wrapped one. Returned data keys are non-extractable AES-256-GCM keys.

## `rotateTo`

**Signature:** `(activeKeyVersion: number) => void`

Accepts only a strictly newer positive safe integer. It changes the version used by future versionless lookups; historical store records remain readable through explicit versions.

## `createWrappedKeyProvider`

**Signature:** `(rootKeyBase64Url: string, store: WrappedDataKeyStore, activeKeyVersion: number) => Promise<WrappedKeyProvider>`

Strictly decodes a 32-byte base64url Worker secret, imports it as non-extractable AES-GCM, zeroes the temporary decoded buffer, and returns the provider. It does not persist or log the secret.

## `createWrappedDataKey`

**Signature:** `(rootKey: CryptoKey, ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord>`

Generates independent random 32-byte data-key material and a fresh 12-byte wrapping IV. AES-GCM wraps the key with a 128-bit tag and owner/domain/version AAD. The temporary raw key buffer is zeroed in `finally`.

## `unwrapDataKey`

**Signature:** `(rootKey: CryptoKey, record: WrappedDataKeyRecord) => Promise<CryptoKey>`

Authenticates and decrypts the 48-byte wrapped value, requires exactly 32 plaintext bytes, imports them as a non-extractable field key, and zeroes the temporary buffer. Wrong root key, IV, ciphertext, owner, domain, or version causes rejection.

## `validateWrappedDataKey`

**Signature:** `(value: WrappedDataKeyRecord, ownerId: string, domain: Domain, keyVersion: number) => WrappedDataKeyRecord`

Requires the exact seven record fields, version `1`, `A256GCM`, exact partition metadata, a 12-byte IV, and a 48-byte wrapped value (32 key bytes plus 16 tag bytes). Unknown versions and algorithms are closed failures.

## `encodeWrappingAad`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Uint8Array<ArrayBuffer>`

Encodes the fixed tuple `["vision-data-key-wrap", 1, ownerId, domain, keyVersion]`. This cryptographically binds wrapped material to its intended data-key partition.

## `validateOwnerAndDomain`

**Signature:** `(ownerId: string, domain: Domain) => void`

Rejects an empty owner identifier and parses the domain through `DomainSchema`, including Vision's intentional `unresolved` partition.

## `validateWrappingKey`

**Signature:** `(rootKey: CryptoKey) => void`

Requires a secret, non-extractable 256-bit AES-GCM key with encrypt and decrypt usage before it can be retained by `WrappedKeyProvider`.
