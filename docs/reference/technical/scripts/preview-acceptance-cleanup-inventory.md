# `scripts/preview-acceptance-cleanup-inventory.ts`

Exports the frozen `PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION` and its four
disposition projections. `task9ChangedPathManifest()` is the ordinal-sorted,
duplicate-free union of `delete_dedicated` and `unwind_shared`. Direct execution
accepts only `--print-task-9-paths`; invalid arguments fail without diagnostics.

## `pathsFor`

Filters the frozen classification array by one closed disposition and freezes
the projected path array.

## `task9ChangedPathManifest`

Combines only `delete_dedicated` and `unwind_shared`, applies ordinal sorting,
and returns a frozen duplicate-free path array.

## `validateReviewedPhaseBAcceptanceClassification`

Requires the reviewed entry count, unique paths, ordinal path ordering, and the
fixed SHA-256 fingerprint over `path`, a zero byte, and disposition. This compact
contract independently detects omission or reclassification without duplicating
the literal path inventory.

## `runCleanupInventoryCli`

Accepts exactly one `--print-task-9-paths` argument and an injected writer.
It writes one repository-relative path per line on success and returns false
without writing for every other argument vector.
