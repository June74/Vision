# `scripts/validate-preview-rollback-lifecycle.ts`
## `derivePreviewBindingProfile`
Prevents caller-selected profiles.

Implements a file-based state machine for the cross-run preview lifecycle:
candidate intent, immutable-normal restore proof, post-restore provider and
authenticated-read closure, then later-candidate or cleanup admission. Every
transition is bound to the reviewed commit and latest candidate run.

## `createPreviewCandidateIntent`

Returns the frozen v1 intent after validating the complete commit digest.

## `assertPreviewCandidateIntent`

Parses the exact intent and requires equality with the workflow's verified
commit.

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
baseline.

## `readLatestPreviewCandidateRunRef`

Validates the provider artifact response, rejects expired or malformed entries,
and deterministically selects the newest creation instant and run ID.

## `validateCompletedPreviewLifecycleRun`

Requires a successful `workflow_dispatch` run at the verified SHA and exactly
one successful job with the expected name.

## `parseRestoreProof`

Validates the exact v1 restore-proof keys, literals, hashes, commit, and ordered
instants.

## `parseCandidateIntent`

Validates the exact v1 intent keys and complete commit.

## `parseClosureProof`

Validates the exact v1 closure keys, verified state literals, hashes, commit,
and canonical instants.

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

## `validDigest`

Requires a complete lowercase SHA-256 digest.

## `validInstant`

Requires a parseable canonical millisecond UTC instant.

## `hashCandidateRunRef`

Uses a domain-separated SHA-256 digest so raw run references do not enter proof
artifacts.

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
completed-run modes; all errors become one value-free failure.
