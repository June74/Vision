# `src/crypto/envelope.ts`

This module is the JSON envelope and field-AAD boundary. `CipherEnvelope` is fixed to `{ version: 1; algorithm: "A256GCM"; keyVersion; iv; ciphertext }`; binary IV and ciphertext values are canonical unpadded base64url. `ProtectedFieldAad` carries `{ ownerId; nodeId; domain; fieldName; keyVersion }`.

`MAX_PROTECTED_PLAINTEXT_BYTES` is 65,536 bytes. The maximum ciphertext is that value plus the 16-byte AES-GCM tag, and `MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS` adds a fixed 512-character metadata allowance. `tests/unit/crypto/envelope.test.ts` and `size-limits.test.ts` cover round trips, tampering, AAD, closed formats, and pre-allocation rejection.

## `encodeBase64Url`

**Signature:** `(bytes: Uint8Array) => string`

Encodes bytes in bounded chunks to avoid argument-size limits, converts the result to RFC 4648 URL-safe characters, and removes padding. It has no cryptographic side effect.

## `decodeBase64Url`

**Signature:** `(value: unknown, label?: string, maximumEncodedLength?: number) => Uint8Array<ArrayBuffer>`

Requires the unpadded base64url alphabet and legal encoded length, rejects values beyond the caller's bound before `atob`, decodes into an `ArrayBuffer`-backed view, then re-encodes to prove canonical form. Failures report only the category label, never input data.

## `validateKeyVersion`

**Signature:** `(keyVersion: unknown) => number`

Rejects zero, negatives, fractions, infinities, and unsafe integers. The returned version is safe to include in AAD and key-store partition keys.

## `validateCipherEnvelope`

**Signature:** `(value: unknown) => CipherEnvelope`

Requires exactly the five envelope properties, version `1`, algorithm `A256GCM`, a positive safe key version, an exactly 16-character encoded IV, and bounded ciphertext. IV and ciphertext encoded sizes are admitted before either is decoded; decoded lengths are then checked for 12 IV bytes and at least the 16-byte tag.

## `serializeCipherEnvelope`

**Signature:** `(envelope: CipherEnvelope) => string`

Revalidates before `JSON.stringify` and verifies the final JSON bound. It returns ciphertext metadata only.

## `parseCipherEnvelope`

**Signature:** `(serialized: string) => CipherEnvelope`

Rejects more than `MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS` before `JSON.parse`, then delegates the closed-format check. Syntax failures use a constant message.

## `encryptText`

**Signature:** `(key: CryptoKey, plaintext: string, aad: ProtectedFieldAad) => Promise<CipherEnvelope>`

Rejects more than 65,536 JavaScript code units before encoding, then enforces the same 65,536-byte UTF-8 limit. It uses Worker AES-GCM with a new 12-byte IV, 128-bit tag, and canonical AAD. It does not persist or log plaintext.

## `decryptText`

**Signature:** `(key: CryptoKey, envelope: CipherEnvelope, aad: ProtectedFieldAad) => Promise<string>`

Validates the key, AAD, and complete envelope before decrypting. It explicitly rejects envelope/AAD key-version
mismatch. AES-GCM rejects wrong owner, node, domain, field, IV, key, version, or modified ciphertext; fatal UTF-8
decoding rejects authenticated non-text bytes.

## `validateProtectedFieldAad`

**Signature:** `(aad: ProtectedFieldAad) => void`

Rejects missing or empty owner, node, and field identifiers, rejects unknown domains, and delegates positive-version
enforcement to `validateKeyVersion`. It runs before every field encryption and decryption.

## `encodeProtectedFieldAad`

**Signature:** `(aad: ProtectedFieldAad) => Uint8Array<ArrayBuffer>`

Encodes `["vision-protected-field", 1, ownerId, nodeId, domain, fieldName, keyVersion]` as UTF-8. The fixed-purpose
JSON tuple provides typed positions and prevents delimiter or concatenation collisions.

## `validateAes256GcmKey`

**Signature:** `(key: CryptoKey, usage: "encrypt" | "decrypt") => void`

Requires a secret, non-extractable AES-GCM key with 256-bit length and the exact requested usage. This prevents accidental use of an extractable, weak, wrong-algorithm, or wrong-purpose key.

## `getBase64UrlEncodedLength`

**Signature:** `(byteLength: number) => number`

Calculates exact unpadded base64url character count from complete three-byte groups and the final one- or two-byte remainder. Module constants use it to keep byte and encoded limits consistent.
