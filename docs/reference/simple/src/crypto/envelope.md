# `src/crypto/envelope.ts`

This module encrypts one text field into a small JSON-safe envelope and decrypts it only in the same owner, node, field, and key-version context.

`CipherEnvelope` records the supported format, AES algorithm, key version, random IV, and ciphertext. `ProtectedFieldAad` describes the metadata that AES-GCM authenticates without exposing it as plaintext content.

## `encodeBase64Url`

Turns bytes into the unpadded URL-safe text used at an envelope boundary.

## `decodeBase64Url`

Turns canonical URL-safe text back into bytes and rejects padded, ambiguous, or malformed input.

## `validateKeyVersion`

Accepts only positive safe integers for cryptographic key versions.

## `validateCipherEnvelope`

Checks every envelope field, allows only version 1 with `A256GCM`, and verifies IV and ciphertext lengths.

## `serializeCipherEnvelope`

Validates an envelope and writes its stable JSON representation.

## `parseCipherEnvelope`

Reads JSON and rejects malformed, incomplete, or extended envelopes.

## `encryptText`

Encrypts UTF-8 text with a fresh random 96-bit IV and field-specific authenticated metadata.

## `decryptText`

Authenticates the exact field context before returning UTF-8 plaintext.

## `validateProtectedFieldAad`

Requires non-empty owner, node, and field identifiers plus a valid key version.

## `encodeProtectedFieldAad`

Creates the unambiguous bytes authenticated with a protected field.

## `validateAes256GcmKey`

Requires a non-extractable 256-bit AES-GCM key with the requested permission.
