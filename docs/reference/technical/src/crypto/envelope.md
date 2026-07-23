# `src/crypto/envelope.ts`

This module is the JSON envelope and field-AAD boundary. `CipherEnvelope` is fixed to `{ version: 1; algorithm: "A256GCM"; keyVersion; iv; ciphertext }`; binary IV and ciphertext values are canonical unpadded base64url. `ProtectedFieldAad` carries `{ ownerId; nodeId; fieldName; keyVersion }`.

`tests/unit/crypto/envelope.test.ts` covers round trips, plaintext absence, IV uniqueness and size, ciphertext tampering, every AAD dimension, unknown versions and algorithms, invalid key versions, malformed base64url, and strict JSON parsing.

## `encodeBase64Url`

**Signature:** `(bytes: Uint8Array) => string`

Encodes bytes in bounded chunks to avoid argument-size limits, converts the result to RFC 4648 URL-safe characters, and removes padding. It has no cryptographic side effect.

## `decodeBase64Url`

**Signature:** `(value: unknown, label?: string) => Uint8Array<ArrayBuffer>`

Requires the unpadded base64url alphabet and legal encoded length, decodes into an `ArrayBuffer`-backed view suitable for Workers Web Crypto, then re-encodes to prove canonical form. Failures report only the caller-supplied category label, never secret data.

## `validateKeyVersion`

**Signature:** `(keyVersion: unknown) => number`

Rejects zero, negatives, fractions, infinities, and unsafe integers. The returned version is safe to include in AAD and key-store partition keys.

## `validateCipherEnvelope`

**Signature:** `(value: unknown) => CipherEnvelope`

Requires exactly the five envelope properties, version `1`, algorithm `A256GCM`, a positive safe key version, a 12-byte IV, and at least the 16-byte authentication tag in ciphertext. Unknown properties are rejected to keep algorithm and format negotiation closed.

## `serializeCipherEnvelope`

**Signature:** `(envelope: CipherEnvelope) => string`

Revalidates before `JSON.stringify`, preventing callers from serializing a type-cast malformed object. It returns JSON containing ciphertext metadata only.

## `parseCipherEnvelope`

**Signature:** `(serialized: string) => CipherEnvelope`

Parses one JSON string and delegates the complete closed-format check to `validateCipherEnvelope`. Syntax failures use a constant message; envelope validation never returns partially accepted data.

## `encryptText`

**Signature:** `(key: CryptoKey, plaintext: string, aad: ProtectedFieldAad) => Promise<CipherEnvelope>`

Uses the Worker global `crypto.subtle.encrypt` with AES-GCM, a newly generated 12-byte IV, a 128-bit tag, and the canonical AAD tuple. The key must be non-extractable AES-256-GCM with encrypt usage. The function returns only the versioned JSON-safe envelope; it does not persist or log plaintext.

## `decryptText`

**Signature:** `(key: CryptoKey, envelope: CipherEnvelope, aad: ProtectedFieldAad) => Promise<string>`

Validates the key, AAD, and complete envelope before decrypting. It explicitly rejects envelope/AAD key-version mismatch. AES-GCM rejects wrong owner, node, field, IV, key, version, or modified ciphertext; fatal UTF-8 decoding rejects authenticated non-text bytes.

## `validateProtectedFieldAad`

**Signature:** `(aad: ProtectedFieldAad) => void`

Rejects missing or empty owner, node, and field identifiers and delegates positive-version enforcement to `validateKeyVersion`. It runs before every field encryption and decryption.

## `encodeProtectedFieldAad`

**Signature:** `(aad: ProtectedFieldAad) => Uint8Array<ArrayBuffer>`

Encodes `["vision-protected-field", 1, ownerId, nodeId, fieldName, keyVersion]` as UTF-8. The fixed-purpose JSON tuple provides typed positions and prevents delimiter or concatenation collisions.

## `validateAes256GcmKey`

**Signature:** `(key: CryptoKey, usage: "encrypt" | "decrypt") => void`

Requires a secret, non-extractable AES-GCM key with 256-bit length and the exact requested usage. This prevents accidental use of an extractable, weak, wrong-algorithm, or wrong-purpose key.
