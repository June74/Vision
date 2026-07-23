# `src/crypto/key-provider.ts`

This module implements envelope encryption for data keys. `WrappedDataKeyStore` supplies record `get`, atomic `putIfAbsent`, authoritative `getActiveKeyVersion`, and atomic monotonic `activateKeyVersion`. Persistence contains only wrapped records plus the numeric high-water mark, never the root or plaintext key.

The versionless path snapshots the authoritative active version exactly once after its first await, then uses that immutable number for record lookup, creation, validation, unwrap, and returned label. A concurrent rotation can linearize before or after that store read, but cannot relabel key material. Explicit historical lookup remains read-only.

`tests/unit/crypto/key-provider.test.ts` deterministically covers rotation during a deferred lookup, restart rollback, competing activation, historical decryption, and wrapped-record size admission.

## `getDataKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion?: number) => Promise<VersionedDataKey>`

With `keyVersion`, fetches exactly that stored version. Without it, awaits the authoritative store version once, captures it in a constant, and uses only that constant through every later await. Missing active records are generated through atomic `putIfAbsent`.

## `rotateTo`

**Signature:** `(activeKeyVersion: number) => Promise<void>`

Reads the authoritative current version, requires a strictly higher candidate, and atomically raises the store mark. It rejects if a competing higher activation wins. Historical records remain readable.

## `createWrappedKeyProvider`

**Signature:** `(rootKeyBase64Url: string, store: WrappedDataKeyStore, activeKeyVersion: number) => Promise<WrappedKeyProvider>`

Prechecks the root's exact 43-character size, canonically decodes 32 bytes, imports it as non-extractable AES-GCM, and calls `fill(0)` on the application-controlled mutable decode buffer. This is best-effort cleanup and does not claim to erase immutable input strings, Web Crypto copies, or engine temporaries. It atomically activates the configured version and rejects when the returned authoritative version is higher, preventing restart rollback.

## `createWrappedDataKey`

**Signature:** `(rootKey: CryptoKey, ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord>`

Generates independent random 32-byte data-key material and a fresh 12-byte wrapping IV. AES-GCM wraps the key with a 128-bit tag and owner/domain/version AAD. The application-controlled mutable raw key buffer is cleared with `fill(0)` in `finally`; runtime-internal copies are outside this best-effort boundary.

## `unwrapDataKey`

**Signature:** `(rootKey: CryptoKey, record: WrappedDataKeyRecord) => Promise<CryptoKey>`

Authenticates and decrypts the 48-byte wrapped value, requires exactly 32 plaintext bytes, imports them as a non-extractable field key, and clears the application-controlled mutable plaintext buffer with `fill(0)`. This does not claim forensic erasure of runtime-internal copies. Wrong root key, IV, ciphertext, owner, domain, or version causes rejection.

## `validateWrappedDataKey`

**Signature:** `(value: WrappedDataKeyRecord, ownerId: string, domain: Domain, keyVersion: number) => WrappedDataKeyRecord`

Requires the exact seven fields, version `1`, `A256GCM`, exact partition metadata, exactly 16 encoded IV characters, and exactly 64 encoded wrapped-key characters before `atob`. Decoded values must be 12 and 48 bytes.

## `encodeWrappingAad`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Uint8Array<ArrayBuffer>`

Encodes the fixed tuple `["vision-data-key-wrap", 1, ownerId, domain, keyVersion]`. This cryptographically binds wrapped material to its intended data-key partition.

## `validateOwnerAndDomain`

**Signature:** `(ownerId: string, domain: Domain) => void`

Rejects an empty owner identifier and parses the domain through `DomainSchema`, including Vision's intentional `unresolved` partition.

## `validateWrappingKey`

**Signature:** `(rootKey: CryptoKey) => void`

Requires a secret, non-extractable 256-bit AES-GCM key with encrypt and decrypt usage before it can be retained by `WrappedKeyProvider`.
