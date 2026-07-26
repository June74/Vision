# `src/crypto/backup-key.ts`

Imports the validated backup-only binding into Web Crypto as a non-extractable AES-256-GCM key with encrypt and
decrypt usages. It never reuses the application data-key wrapping secret.

## `importBackupEncryptionKey`

Copies the canonical decoded bytes into an `ArrayBuffer`-backed view for Web Crypto, brands the result with its key
version, and clears both mutable byte buffers in `finally`.
