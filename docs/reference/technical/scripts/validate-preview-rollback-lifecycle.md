# `scripts/validate-preview-rollback-lifecycle.ts`
## `derivePreviewBindingProfile`
Prevents caller-selected profiles.

Implements a file-based state machine for the cross-run preview lifecycle:
candidate intent, immutable-normal restore proof, post-restore provider and
authenticated-read closure, then later-candidate or cleanup admission. Every
transition is bound to the reviewed commit and latest candidate run.

## `createPreviewCandidateIntent`

Returns a frozen v2 intent after validating the commit and operation, deriving
the exact acceptance bindings, and hashing the complete generated config.

## `createPreviewCandidateMutationBoundary`

Creates the frozen v1 marker that arms the may-mutate boundary after every
predeploy check. Domain-separated hashes bind it to the canonical intent and
numeric candidate run.

## `assertPreviewCandidateMutationBoundary`

Reparses the intent and exact boundary, re-derives both hashes, and requires
the reviewed commit and candidate run to match.

## `readPreviewCandidateMutationState`

Requires an exact candidate intent and zero-or-one artifact response for the
candidate run. For v2, zero proves `not_started` and one current correctly
owned boundary yields `may_have_started`. Exact v1 intents cannot possess the
new v2-only boundary, so zero conservatively yields `may_have_started`; this
admits only exact normal or an exact frozen-v1 known candidate inventory into
the unconditional immutable-normal redeploy and fresh exact-normal
verification. A v1 intent with a boundary, hybrid intents, duplicates, and
stale or foreign artifacts fail closed.

## `readPreviewCandidateIntentVersion`

Reuses the exact candidate-intent parser and emits only the schema-generation
label `v1` or `v2`; hybrids and malformed records fail closed. The workflow
uses a closed version/state matrix: legacy `v1:may_have_started` alone bypasses
the v2-only mutation-boundary artifact lookup, `v2:not_started` needs no
boundary, and `v2:may_have_started` requires the exact boundary download and
verification. Every admitted branch continues through exact provider-state
admission, immutable-normal deployment, fresh exact-normal verification,
restore proof, and closure.

## `assertPreviewCandidateIntent`

Parses the exact intent and requires equality with the workflow's verified
commit.

## `readPreviewCandidateBindingProfile`

Parses the exact commit-bound intent and returns only the binding profile
derived from its operation.

## `readPreviewCandidateIntentDetails`

Parses and commit-binds the intent, then exposes only provider-relevant v2
fields or an explicit legacy-v1 recovery marker.

## `createPreviewRollbackRestoreProof`

Hashes the candidate run reference and records the restored commit plus ordered
restore/provider-verification instants.

## `closePreviewRollback`

Requires the exact restore proof, same candidate and commit, a verified
authenticated-read gate, a later closure provider check, and a later close
instant.

## `assertPreviewRollbackClosure`

Admits only candidate or cleanup operations bound to the latest candidate,
normal commit, two ordered provider checks, and completed closure. A null proof
is admitted only for the first candidate when the artifact query proves the
baseline. Normal deployment is separately admitted only at that baseline or
from the exact latest same-commit closure.

## `readLatestPreviewCandidateRunRef`

Validates the provider artifact response, rejects expired or malformed entries,
and deterministically selects the newest creation instant and run ID.

## `validateCompletedPreviewLifecycleRun`

Requires a successful `workflow_dispatch` run at the verified SHA and exactly
one successful job with the expected name.

## `parseRestoreProof`

Validates the distinct exact v1 and v2 restore-proof schemas.

## `validRestoreProofCommon`

Validates the digest, commit, verified-state literal, millisecond instants, and
their strict ordering shared by both schema generations.

## `parseCandidateIntent`

Validates either the legacy two-key v1 marker or the full v2 config-bound
marker; hybrid and in-place-mutated shapes are rejected.

## `parseCandidateMutationBoundary`

Validates the exact mutation-boundary evidence type and its two complete
SHA-256 digests.

## `allowedCandidateTransition`

Enforces the closed role-to-restore-or-cleanup, restore-to-cleanup, and
normal-profile transition graph.

## `allowedIntentTransition`

Applies the v2 transition graph and the explicit v1 migration rule. Legacy v1
may recover into cleanup or a non-restore candidate, but never direct restore.

## `allowedClosureTransition`

Binds v2 closure operation/profile provenance to its candidate intent while
allowing a newer independently verified deployment commit.

## `isNonRestoreCandidateOperation`

Narrows baseline and normal-closure successors to normal candidates or the
role probe, excluding direct restore before any provider action.

## `validCandidateOperation`

Requires exact membership in the candidate-operation vocabulary.

## `isCandidateOperation`

Narrows unknown workflow input without string coercion.

## `parseClosureProof`

Validates the distinct exact v1 and v2 closure schemas.

## `validClosureProofCommon`

Validates the hashes, commit, state literals, and local millisecond timestamps
shared by both closure generations.

## `exactKeys`

Compares own enumerable data descriptors against one sorted exact string-key
set.

## `ownDataValue`

Reads only an enumerable own data descriptor.

## `plainObject`

Admits only non-null, non-array objects with the default prototype.

## `validCommit`

Requires a complete lowercase commit digest.

## `validRunRef`

Requires `baseline` or a positive bounded decimal workflow run.

## `validNumericRunRef`

Requires the positive decimal workflow-run branch and excludes `baseline`.

## `validDigest`

Requires a complete lowercase SHA-256 digest.

## `validInstant`

Requires a parseable canonical millisecond UTC instant.

## `validProviderInstant`

Requires GitHub metadata to use its canonical whole-second UTC grammar.

## `readCandidateAcceptanceBindings`

Derives the operation-specific scenario, canonical expiry, and AI-only
attestation from the exact generated config variables.

## `validAcceptanceBindings`

Reconstructs and revalidates the temporary binding subset stored in v2 intent.

## `digestCanonicalValue`

SHA-256 hashes the recursively canonicalized JSON value.

## `canonicalizeJson`

Rejects accessors, symbols, unsupported values, non-plain objects, non-finite
numbers, and excessive nesting while sorting every object-key level.

## `hashCandidateRunRef`

Uses a domain-separated SHA-256 digest so raw run references do not enter proof
artifacts.

## `digestCandidateIntent`

Canonicalizes the parsed intent field order and hashes it for immutable
mutation-boundary binding.

## `digestRecord`

Hashes the canonical restored-normal proof for closure binding.

## `readPairs`

Parses unique `--name value` pairs and rejects aliases, repeats, or positional
values.

## `readJson`

Reads and parses one required file while keeping its content out of output.

## `writeJson`

Writes canonical formatted JSON with exclusive creation.

## `main`

Routes only the approved intent, restore, closure, latest-candidate, and
completed-run modes plus mutation-boundary write, classify, and verify modes;
all errors become one value-free failure. Classification and intent-version
reading emit only fixed safe labels.
