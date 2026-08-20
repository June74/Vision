# `scripts/preview-acceptance-cleanup-inventory.ts`

Exports the frozen `PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION` and its four
disposition projections. `task9ChangedPathManifest()` is the ordinal-sorted,
duplicate-free union of `delete_dedicated` and `unwind_shared`. Direct execution
accepts only `--print-task-9-paths` or `--refresh-digests`; invalid arguments
fail without diagnostics.

Because `tests/security/temporary-surface-cleanup.test.ts` cross-checks the
classification against a live `docs/operations` directory listing, every new
top-level operations document must be classified here. `--refresh-digests`
recomputes the five frozen fingerprints that change with it. The test-local
array lengths in that suite remain a deliberate manual review step.

## `pathsFor`

Filters the frozen classification array by one closed disposition and freezes
the projected path array.

## `digestOf`

Counts a canonical line set and fingerprints its newline-joined form with
SHA-256. It is the single hashing implementation behind both the reviewed
fingerprint check and the refresh mode.

## `sortedPathsFor`

Projects one disposition's paths from already ordinal-sorted classification
rows, preserving that ordering for the per-disposition fingerprints.

## `classificationDigestContract`

Returns `{ count, sha256 }` for the full sorted row set — hashed over `path`, a
zero byte, and disposition — and for each of the four disposition projections
hashed over paths alone. The shape matches the test's
`REVIEWED_CLASSIFICATION_CONTRACT` exactly.

## `renderRefreshedDigests`

Renders both frozen sites as paste-ready TypeScript: the script's
`REVIEWED_CLASSIFICATION_COUNT` and `REVIEWED_CLASSIFICATION_SHA256`, then the
test's `REVIEWED_CLASSIFICATION_CONTRACT`. Output is byte-identical to the
current source when the inventory is in sync, so a refresh produces a diff
confined to changed values.

## `validateReviewedPhaseBAcceptanceClassification`

Requires unique paths, then the reviewed entry count and the fixed SHA-256
fingerprint from `classificationDigestContract`. This compact contract
independently detects omission or reclassification without duplicating the
literal path inventory.

## `task9ChangedPathManifest`

Combines only `delete_dedicated` and `unwind_shared`, applies ordinal sorting,
and returns a frozen duplicate-free path array.

## `runCleanupInventoryCli`

Accepts exactly one argument and an injected writer. `--print-task-9-paths`
writes one repository-relative path per line; `--refresh-digests` writes the
rendered constant blocks. Every other argument vector returns false without
writing.
