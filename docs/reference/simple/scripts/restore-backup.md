# `scripts/restore-backup.ts`

Provides the operator-only command for restoring one encrypted backup to an explicitly disposable preview database.

## `runRestoreBackupCommand`

Validates the command and environment before reading an object, verifies its independent metadata and body reads,
decrypts and validates it locally, performs the transactional restore, and prints only row counts and checksums.

## `parseArguments`

Accepts only the closed preview restore grammar, exact confirmation phrase, fixed object path, and optional
replacement assertion.

## `createCloudflareR2BackupObjectReader`

Builds a preview-only reader for the authenticated Cloudflare object API.

## `read`

Reads one private object and either discards or returns its bounded body.

## `head`

Returns one independent metadata and identity view.

## `get`

Returns a second metadata and identity view with the encrypted body.

## `parseCloudflareObjectHeaders`

Maps the ETag, four safe custom fields, and native SHA-256 header to the shared backup reader.

## `parseNativeSha256`

Accepts one canonical 32-byte SHA-256 header and converts it to Vision's checksum form.

## `productionDependencies`

Connects the command to the private preview bucket, the preview Neon target, and safe standard output.

## `createTarget`

Creates a target whose operator-supplied name must match the connected database's disposable-preview attestation.

## `writeOutput`

Prints one already-redacted report line.

## `main`

Maps every command failure to one safe message and a nonzero exit code.
