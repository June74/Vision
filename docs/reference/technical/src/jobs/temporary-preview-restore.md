# `src/jobs/temporary-preview-restore.ts`

Implements the injected preview-only restore engine. Concrete provider construction remains outside this module so
tests and the temporary Worker can supply narrow storage, restore-target, snapshot-read, and event-count boundaries.

## `runTemporaryPreviewRestore`

Strictly parses only the temporary preview bindings, selects the sole newest admitted candidate across complete
pagination, and runs the shared stored-backup verifier before opening the target. It invokes the shared importer with
replacement disabled and the preview assertion, always closes the managed restore pool, and never returns the
selected storage identity or target identity.

After promotion, it obtains an independent migration-9 snapshot, derives all 29 counts, validates cross-table
references, canonically re-encodes and hashes the snapshot, and requires equality with the import report. It also
requires a nonnegative safe-integer event count and a false replacement result before emitting closed success
evidence.

## `selectBackupCandidate`

Traverses every page under the fixed private backup prefix, rejects malformed entries and invalid or repeated
cursors, requires an unambiguous greatest UTC date, and compares the admitted metadata key version with the injected
unchanged backup key version.

## `classifyImportFailure`

Maps only stable value-free importer messages into attestation, non-empty target, backup validation, promotion, or
unknown categories. The original error object never enters evidence.

## `rowCountsMatch`

Compares the read-back and import-report counts in the canonical authoritative table order.

## `failedEvidence`

Returns the frozen three-field failure shape containing only the evidence version, failed outcome, and closed
category.
