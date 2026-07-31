# validate-preview-rollback-lifecycle
## `derivePreviewBindingProfile`
Derives normal or restore-pair bindings.

Enforces the candidate, rollback, signed-in recheck, and closure sequence across
separate preview workflow runs. Its files contain only hashes, timestamps,
status labels, and commit/run bindings.

## `createPreviewCandidateIntent`

Creates the marker that must be uploaded before preview mutation.

## `createPreviewCandidateMutationBoundary`

Creates the immutable marker immediately before a candidate deployment may be
attempted. Its hashes bind the exact intent and candidate run without exposing
either value.

## `assertPreviewCandidateMutationBoundary`

Rejects a boundary copied from another intent, run, or reviewed commit.

## `readPreviewCandidateMutationState`

Returns `not_started` only when the candidate run has no mutation-boundary
artifact. Exactly one current artifact returns `may_have_started`; duplicates,
expired artifacts, and artifacts from another run fail closed.

## `assertPreviewCandidateIntent`

Checks that the downloaded marker belongs to the reviewed commit.

## `readPreviewCandidateBindingProfile`

Returns the operation-derived binding profile from an exact commit-bound
candidate marker.

## `createPreviewRollbackRestoreProof`

Creates proof only after the normal commit and provider state are restored.

## `closePreviewRollback`

Creates closure only after a later provider check and signed-in read gate.

## `assertPreviewRollbackClosure`

Blocks later candidates, normal deployment, and cleanup until the newest
candidate is closed. Normal deployment is admitted at baseline or from the
exact latest closure only.

## `readLatestPreviewCandidateRunRef`

Selects the newest valid candidate marker or the empty baseline.

## `validateCompletedPreviewLifecycleRun`

Checks one exact successful rollback or closure job at the reviewed commit.

## `parseRestoreProof`

Accepts only the exact restored-normal proof shape.

## `parseCandidateIntent`

Accepts only the exact candidate marker shape.

## `parseCandidateMutationBoundary`

Accepts only the exact value-free mutation-boundary proof shape.

## `allowedCandidateTransition`

Checks the one allowed same-commit follow-on operation.

## `isNonRestoreCandidateOperation`

Allows a baseline or normal closure to start a normal candidate or role probe,
but never a restore.

## `validCandidateOperation`

Recognizes one exact candidate operation.

## `isCandidateOperation`

Narrows an unknown value to the same closed operation vocabulary.

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

## `validNumericRunRef`

Checks a positive workflow-run reference and rejects the baseline alias.

## `validDigest`

Checks a complete lifecycle hash.

## `validInstant`

Checks a canonical UTC timestamp.

## `hashCandidateRunRef`

Hashes the candidate run reference before it enters proof files.

## `digestCandidateIntent`

Hashes the canonical candidate intent for the mutation-boundary proof.

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
printing identifiers. Mutation-boundary classification prints only one of the
two fixed state labels.
