# `src/crypto/backup-envelope.ts`

The envelope is a closed `vision-backup-envelope` version 1 object using AES-256-GCM. Only envelope routing metadata
is visible; both the logical manifest and canonical NDJSON remain ciphertext. The 96-bit IV is generated per export,
and additional authenticated data binds purpose, version, algorithm, and key version. Plaintext is bounded to 16 MiB
for the private-pilot Worker memory boundary.

## `createBackupEncryptionKey`

Creates the explicit `vision-backup` purpose wrapper after requiring a non-extractable AES-GCM key with both usages.
Application data-key APIs do not produce this wrapper.

## `encryptBackupEnvelope`

Rejects oversized or non-byte input, generates a fresh 12-byte IV, authenticates the fixed AAD tuple, and returns
canonical unpadded base64url fields.

## `decryptBackupEnvelope`

Validates structure and exact key-version agreement before AES-GCM decryption. Authentication errors collapse to one
safe failure and never return partial plaintext.

## `serializeEncryptedBackup`

Reconstructs fields in a deterministic order after strict validation.

## `parseEncryptedBackup`

Bounds serialized input before JSON allocation and delegates all semantic checks to the envelope validator.

## `validateEncryptedBackup`

Rejects prototypes, accessors, symbols, extra fields, version/algorithm drift, non-96-bit IVs, oversized ciphertext,
and noncanonical base64url.

## `backupEnvelopeAad`

Encodes `["vision-backup-envelope", 1, "A256GCM", keyVersion]` without ambiguous concatenation.

## `validateBackupKey`

Requires the backup-purpose discriminator and a positive safe key version on every cryptographic call.

## `validateBackupCryptoKey`

Prevents extractable, weak, wrong-algorithm, or one-direction-only keys from entering the backup boundary.

## `copyToArrayBuffer`

Normalizes an arbitrary byte view to owned `ArrayBuffer` storage for cross-runtime Web Crypto typing.
