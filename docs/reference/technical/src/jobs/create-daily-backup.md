# `src/jobs/create-daily-backup.ts`

Orchestrates one deterministic, encrypted, conditionally written logical backup per UTC date. Success requires
post-write verification through independent object metadata and body reads.

## `createDailyBackup`

Derives the daily opaque key, reuses only a verified existing object, exports a consistent migration-9 snapshot,
serializes the encrypted envelope, computes body and ciphertext SHA-256 digests, and uses atomic create-if-absent.
A newly created object that fails verification is removed best-effort and never reported as successful.

## `verifyStoredBackup`

Requires stable key, ETag, native R2 body checksum, exact closed metadata, canonical envelope serialization, matching
key version, and matching ciphertext digest. It also authenticates AES-GCM with the matching backup key, validates the
encrypted manifest and UTC date, verifies the plaintext archive digest, parses the complete canonical archive, and
compares all 29 row counts before success. Mutable plaintext/archive buffers are cleared afterward.

## `readVerifiedStoredBackup`

Owns the shared head/get identity, native checksum, calculated checksum, envelope, decryption, manifest, archive,
and row-count acceptance path. It returns both the safe result and the verified encrypted envelope so restore imports
the exact body that passed verification instead of performing a third mutable read.

## `dailyObjectKey`

Hashes a domain-separated UTC date and places the opaque digest under the fixed versioned date prefix.

## `utcDate`

Rejects invalid dates and derives the canonical UTC calendar date without local-time conversion.

## `validateMetadata`

Requires exactly `format`, `createdDate`, `ciphertextSha256`, and `keyVersion`, including canonical digest and positive
safe-integer forms.
