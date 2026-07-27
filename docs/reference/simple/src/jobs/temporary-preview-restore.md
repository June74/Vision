# `src/jobs/temporary-preview-restore.ts`

Restores the newest valid backup only into a separately configured, disposable preview database. It reports only
closed status, counts, and booleans.

## `runTemporaryPreviewRestore`

Checks the temporary preview settings, selects and verifies one backup, restores it without replacement, closes the
restore connection, and then independently reads the database back. Success requires matching all 29 table counts,
matching archive checksum, valid references, and a readable event list.

## `selectBackupCandidate`

Reads every storage page, rejects any malformed entry, and selects exactly one backup from the newest UTC date with
the expected unchanged key version.

## `classifyImportFailure`

Maps value-free restore errors into the fixed safe failure categories.

## `rowCountsMatch`

Checks that every authoritative table has the same restored and read-back row count.

## `failedEvidence`

Creates the minimal failure result without retaining configuration, provider details, or protected data.
