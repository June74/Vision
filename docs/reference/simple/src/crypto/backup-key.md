# `src/crypto/backup-key.ts`

Turns the separate backup secret into a non-exportable AES key. The temporary decoded bytes are cleared after import.

## `importBackupEncryptionKey`

Accepts only a canonical 256-bit backup key and attaches its positive version for encrypted backup envelopes.
