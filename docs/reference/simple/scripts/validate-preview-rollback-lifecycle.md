# validate-preview-rollback-lifecycle
## `derivePreviewBindingProfile`
Derives normal or restore-pair bindings.

Enforces the candidate, rollback, signed-in recheck, and closure sequence across
separate preview workflow runs. Its files contain only hashes, timestamps,
status labels, and commit/run bindings.

## `createPreviewCandidateIntent`

Creates a v2 marker that binds the commit, operation, exact temporary values,
and a digest of the generated candidate configuration.

## `createPreviewCandidateMutationBoundary`

Creates the immutable marker immediately before a candidate deployment may be
attempted. Its hashes bind the exact intent and candidate run without exposing
either value.

## `assertPreviewCandidateMutationBoundary`

Rejects a boundary copied from another intent, run, or reviewed commit.

## `readPreviewCandidateMutationState`

Reads the exact candidate-intent version before classifying artifacts. A v2
intent with no boundary returns `not_started`; one current v2 boundary returns
`may_have_started`. Because v1 workflows predate boundary artifacts, an exact
v1 intent with no boundary conservatively returns `may_have_started`, allowing
only exact normal or a frozen known v1 candidate state before the workflow
still redeploys and freshly verifies immutable normal. A v1 intent paired with
a v2 boundary, duplicates, expired artifacts, and foreign artifacts fail
closed.

## `readPreviewCandidateIntentVersion`

Returns only `v1` or `v2` after parsing the exact candidate intent. Hybrid or
malformed markers fail closed. The rollback workflow combines this label with
the mutation state in a closed matrix: only legacy `v1:may_have_started` skips
the v2-only boundary download, while `v2:may_have_started` must download and
verify that exact boundary. Both paths still pass provider admission, redeploy
immutable normal, freshly verify normal, create restore proof, and close.

## `assertPreviewCandidateIntent`

Checks that the downloaded marker belongs to the reviewed commit.

## `readPreviewCandidateBindingProfile`

Returns the operation-derived binding profile from an exact commit-bound
candidate marker.

## `readPreviewCandidateIntentDetails`

Returns only the validated provider-state details from a v2 marker, or a safe
legacy label for an exact old v1 marker.

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

Accepts only an exact v1 or v2 restored-normal proof shape.

## `validRestoreProofCommon`

Checks the fields and ordered local timestamps shared by both proof versions.

## `parseCandidateIntent`

Accepts only the exact candidate marker shape.

## `parseCandidateMutationBoundary`

Accepts only the exact value-free mutation-boundary proof shape.

## `allowedCandidateTransition`

Checks the one allowed same-commit follow-on operation.

## `allowedIntentTransition`

Keeps old v1 markers recoverable while forbidding direct restore without v2
operation provenance.

## `allowedClosureTransition`

Checks closure provenance separately from the commit being newly deployed.

## `isNonRestoreCandidateOperation`

Allows a baseline or normal closure to start a normal candidate or role probe,
but never a restore.

## `validCandidateOperation`

Recognizes one exact candidate operation.

## `isCandidateOperation`

Narrows an unknown value to the same closed operation vocabulary.

## `parseClosureProof`

Accepts only an exact v1 or v2 closure shape.

## `validClosureProofCommon`

Checks the proof fields shared by both closure versions.

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

Checks a canonical millisecond UTC timestamp for locally created proofs.

## `validProviderInstant`

Checks the canonical whole-second UTC timestamps returned by GitHub.

## `readCandidateAcceptanceBindings`

Reads the exact scenario, expiry, and AI-only attestation from a generated
candidate configuration.

## `validAcceptanceBindings`

Rechecks the temporary values embedded in a downloaded v2 intent.

## `digestCanonicalValue`

Hashes one deterministic, accessor-free JSON representation.

## `canonicalizeJson`

Recursively sorts safe JSON object keys before hashing.

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
printing identifiers. Mutation-boundary classification and intent-version
reading print only their fixed safe labels.
