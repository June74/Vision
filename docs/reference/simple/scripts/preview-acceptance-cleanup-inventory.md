# Preview acceptance cleanup inventory

This permanent script is the single reviewed list of Phase B acceptance paths.
Every path is marked for dedicated deletion, shared-file cleanup, permanent
retention, or historical retention. Its only command-line mode prints the exact
Task 9 paths, one path per line, without file contents or provider data.

## `pathsFor`

Selects the paths assigned to one of the four reviewed dispositions.

## `task9ChangedPathManifest`

Returns only the sorted dedicated-delete and shared-unwind paths for Task 9.

## `validateReviewedPhaseBAcceptanceClassification`

Checks a proposed inventory against the compact reviewed Task 1-8 fingerprint.
Removing or reclassifying any path fails without maintaining a second path list.

## `runCleanupInventoryCli`

Prints the manifest only for `--print-task-9-paths`. Every other argument set
fails without diagnostic output.
