# `scripts/restore-backup.ts`

Provides the operator-only command for restoring one encrypted backup to an explicitly disposable preview database.

## `runRestoreBackupCommand`

Validates the command and environment before reading an object, decrypts and validates it locally, performs the
transactional restore, and prints only row counts and checksums.

## `parseArguments`

Accepts only the closed preview restore grammar, exact confirmation phrase, fixed object path, and optional
replacement assertion.

## `readBackupObjectWithWrangler`

Downloads one encrypted R2 object into a temporary directory and removes the directory afterward.

## `productionDependencies`

Connects the command to Wrangler, the preview Neon target, and safe standard output.

## `createTarget`

Creates a target whose operator-supplied name must match the connected database's disposable-preview attestation.

## `writeOutput`

Prints one already-redacted report line.

## `main`

Maps every command failure to one safe message and a nonzero exit code.
