# `src/crypto/backup-envelope.ts`

Encrypts the complete manifest and archive with a separately identified backup AES key and a fresh random IV.

## `createBackupEncryptionKey`

Admits only a non-extractable 256-bit AES-GCM key with encrypt and decrypt permission.

## `encryptBackupEnvelope`

Encrypts one bounded payload with a new IV and authenticated backup metadata.

## `decryptBackupEnvelope`

Authenticates the whole object before returning any plaintext.

## `serializeEncryptedBackup`

Writes the validated encrypted object as closed JSON.

## `parseEncryptedBackup`

Reads persisted JSON and revalidates every envelope field.

## `validateEncryptedBackup`

Rejects unknown versions, algorithms, fields, sizes, and noncanonical binary encodings.

## `backupEnvelopeAad`

Builds the authenticated purpose, format, algorithm, and key-version bytes.

## `validateBackupKey`

Checks the backup-purpose wrapper and key version.

## `validateBackupCryptoKey`

Checks the underlying key's algorithm, length, extractability, and permissions.

## `copyToArrayBuffer`

Copies bytes into memory accepted by the Worker Web Crypto API.
