# `src/crypto/envelope.ts`

This module encrypts one text field into a small JSON-safe envelope and decrypts it only in the same owner, node,
domain, field, and key-version context.

`CipherEnvelope` records the supported format, AES algorithm, key version, random IV, and ciphertext. `ProtectedFieldAad` describes the metadata that AES-GCM authenticates without exposing it as plaintext content.

One protected field may contain at most 64 KiB of UTF-8 plaintext. Ciphertext and serialized JSON have matching limits and are rejected before large decoding or parsing work.

## `encodeBase64Url`

Turns bytes into the unpadded URL-safe text used at an envelope boundary.

## `decodeBase64Url`

Turns bounded canonical URL-safe text back into bytes and rejects padded, ambiguous, malformed, or oversized input.

## `validateKeyVersion`

Accepts only positive safe integers for cryptographic key versions.

## `validateCipherEnvelope`

Checks every envelope field, allows only version 1 with `A256GCM`, and verifies encoded sizes before decoding.

## `serializeCipherEnvelope`

Validates an envelope and writes its stable JSON representation.

## `parseCipherEnvelope`

Rejects oversized input before reading JSON, then rejects malformed, incomplete, or extended envelopes.

## `encryptText`

Encrypts up to 64 KiB of UTF-8 text with a fresh random 96-bit IV and field-specific authenticated metadata.

## `decryptText`

Authenticates the exact field context before returning UTF-8 plaintext.

## `validateProtectedFieldAad`

Requires non-empty owner, node, and field identifiers, a valid domain, and a valid key version.

## `encodeProtectedFieldAad`

Creates the unambiguous bytes authenticated with a protected field.

## `validateAes256GcmKey`

Requires a non-extractable 256-bit AES-GCM key with the requested permission.

## `getBase64UrlEncodedLength`

Calculates the exact unpadded base64url size used for safe admission limits.
