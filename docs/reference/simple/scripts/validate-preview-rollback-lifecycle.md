# validate-preview-rollback-lifecycle

Enforces the candidate, rollback, signed-in recheck, and closure sequence across
separate preview workflow runs. Its files contain only hashes, timestamps,
status labels, and commit/run bindings.

## `createPreviewCandidateIntent`

Creates the marker that must be uploaded before preview mutation.

## `assertPreviewCandidateIntent`

Checks that the downloaded marker belongs to the reviewed commit.

## `createPreviewRollbackRestoreProof`

Creates proof only after the normal commit and provider state are restored.

## `closePreviewRollback`

Creates closure only after a later provider check and signed-in read gate.

## `assertPreviewRollbackClosure`

Blocks later candidates and cleanup until the newest candidate is closed.

## `readLatestPreviewCandidateRunRef`

Selects the newest valid candidate marker or the empty baseline.

## `validateCompletedPreviewLifecycleRun`

Checks one exact successful rollback or closure job at the reviewed commit.

## `parseRestoreProof`

Accepts only the exact restored-normal proof shape.

## `parseCandidateIntent`

Accepts only the exact candidate marker shape.

## `parseClosureProof`

Accepts only the exact closure shape.

## `exactKeys`

Requires an exact ordinary key inventory.

## `ownDataValue`

Reads one own data property without invoking a getter.

## `plainObject`

Accepts only a normal data object.

## `validCommit`

Checks a complete commit digest.

## `validRunRef`

Checks a positive workflow-run reference or the first-run baseline.

## `validDigest`

Checks a complete lifecycle hash.

## `validInstant`

Checks a canonical UTC timestamp.

## `hashCandidateRunRef`

Hashes the candidate run reference before it enters proof files.

## `digestRecord`

Hashes the restored-normal proof before closure.

## `readPairs`

Accepts only unique named command pairs.

## `readJson`

Reads one required lifecycle artifact.

## `writeJson`

Creates one lifecycle artifact without overwriting an existing file.

## `main`

Dispatches the closed lifecycle validation and transition modes without
printing identifiers.
