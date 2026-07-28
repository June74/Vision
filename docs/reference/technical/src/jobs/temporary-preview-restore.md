# `src/jobs/temporary-preview-restore.ts`

Implements the injected preview-only restore engine. Concrete provider construction remains outside this module so
tests and the temporary Worker can supply narrow storage, atomic attempt, serializable clear, restore-target,
snapshot-read, and event-count boundaries.

## `runTemporaryPreviewRestore`

Strictly parses only the temporary preview bindings, selects the sole newest admitted candidate across complete
pagination, runs stored-object verification, and creates the module-issued prepared import before claiming or
opening the target. Every pre-claim rejection returns `null`. It then atomically claims the opaque attempt; a false
or uncertain claim also returns `null`. All of those paths make no database call and emit no log. The owner clears
through the prepared 29-key counts and imports that exact prepared token with replacement disabled.

After promotion, it obtains an independent migration-9 snapshot, derives all 29 counts, validates cross-table
references, canonically re-encodes and hashes the snapshot, and requires equality with the import report. It also
requires a nonnegative safe-integer event count and a false replacement result before emitting closed success
evidence. Only the owner can return a post-claim failure.

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
