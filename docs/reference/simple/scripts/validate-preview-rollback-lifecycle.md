# validate-preview-rollback-lifecycle
## `derivePreviewBindingProfile`
Derives normal or restore-pair bindings.

Enforces the candidate, rollback, signed-in recheck, and closure sequence across
separate preview workflow runs. Its files contain only hashes, timestamps,
status labels, and commit/run bindings.

## `createPreviewCandidateIntent`

Creates the unchanged v2 marker for non-AI candidates and an AI-only v3 marker
that also binds the exact scheduled evidence instant. Both bind the commit,
operation, temporary values, and generated-config digest.

## `createPreviewCandidateMutationBoundary`

Creates the immutable marker immediately before a candidate deployment may be
attempted. Its hashes bind the exact intent and candidate run without exposing
either value.

## `assertPreviewCandidateMutationBoundary`

Rejects a boundary copied from another intent, run, or reviewed commit.

## `readPreviewCandidateMutationState`

Reads the exact candidate-intent version before classifying artifacts. A v2 or
v3 intent with no boundary returns `not_started`; one current boundary returns
`may_have_started`. Because v1 workflows predate boundary artifacts, an exact
v1 intent with no boundary conservatively returns `may_have_started`, allowing
only exact normal or a frozen known v1 candidate state before the workflow
still redeploys and freshly verifies immutable normal. A v1 intent paired with
a boundary, duplicates, expired artifacts, and foreign artifacts fail closed.

## `readPreviewCandidateIntentVersion`

Returns only `v1`, `v2`, or `v3` after parsing the exact candidate intent.
Hybrid or malformed markers fail closed. The rollback workflow combines this
label with the mutation state in a closed matrix: only legacy
`v1:may_have_started` skips the config-bound boundary rules, while v2 and v3
uncertain states download and verify the exact boundary. Every path still
passes provider admission, redeploys immutable normal, freshly verifies
normal, creates restore proof, and closes.

## `assertPreviewCandidateIntent`

Checks that the downloaded marker belongs to the reviewed commit.

## `readPreviewCandidateBindingProfile`

Returns the operation-derived binding profile from an exact commit-bound
candidate marker.

## `readPreviewCandidateIntentDetails`

Returns only the validated provider-state details and exact v2 or v3 generation,
or a safe legacy label for an exact old v1 marker.

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

Accepts exact legacy v1, unchanged v2, or AI-only v3 candidate markers.

## `parseCandidateMutationBoundary`

Accepts only the exact value-free mutation-boundary proof shape.

## `allowedCandidateTransition`

Checks the one allowed same-commit follow-on operation.

## `allowedIntentTransition`

Keeps old v1 markers recoverable while forbidding direct restore without
config-bound v2 or v3 operation provenance.

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
candidate configuration. AI v3 also requires and binds the canonical scheduled
evidence instant; v2 and every non-AI configuration reject that field.

## `validCandidateAiEvidenceWindow`

Validates the complete AI-only scheduled window while keeping parser failures
inside the lifecycle's single safe failure category.

## `validAcceptanceBindings`

Rechecks the exact temporary values embedded in downloaded v2 or v3 intent.

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
reading print only their fixed safe labels. Candidate-operation reading first
validates the current intent and prints only its closed operation label.

## `assertPreviewRollbackProofChain`

Requires the candidate intent, candidate run, restored-normal proof, and
closure proof to describe one exact reviewed operation and commit in the right
order.
