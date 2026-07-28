# `src/jobs/temporary-preview-restore.ts`

Restores the newest valid backup only into a separately configured, disposable preview database. It fully prepares
the backup, claims one opaque attempt, clears the exact matching target, and reports only closed status, counts, and
booleans.

## `runTemporaryPreviewRestore`

Checks the temporary preview settings, selects and verifies one backup, and completes all preparation before the
claim. Any pre-claim failure, uncertain claim, or non-owner returns nothing, performs no database work, and logs
nothing. The owner clears only the attested count-matching target, imports the same prepared object without
replacement, closes the restore connection, and independently reads the database back. Success still requires all 29
counts, checksum, references, and a readable event list.

## `selectBackupCandidate`

Reads every storage page, rejects any malformed entry, and selects exactly one backup from the newest UTC date with
the expected unchanged key version.

## `classifyImportFailure`

Maps value-free restore errors into the fixed safe failure categories.

## `rowCountsMatch`

Checks that every authoritative table has the same restored and read-back row count.

## `failedEvidence`

Creates the minimal failure result without retaining configuration, provider details, or protected data.
