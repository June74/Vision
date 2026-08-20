# Preview acceptance cleanup inventory

This permanent script is the single reviewed list of Phase B acceptance paths.
Every path is marked for dedicated deletion, shared-file cleanup, permanent
retention, or historical retention. One command-line mode prints the exact
Task 9 paths, one path per line; the other reprints the frozen fingerprints
after a reviewed change. Neither prints file contents or provider data.

Adding a new document under `docs/operations` requires adding it here too,
because the cleanup test compares this list against the real directory. Run
`--refresh-digests` and paste its output over the two fingerprint blocks it
names.

## `pathsFor`

Selects the paths assigned to one of the four reviewed dispositions.

## `digestOf`

Counts a set of lines and produces one fingerprint for them.

## `sortedPathsFor`

Picks out the paths for one disposition, keeping the sorted order.

## `classificationDigestContract`

Produces the count and fingerprint for the whole list and for each of the four
dispositions, in the same shape the cleanup test checks against.

## `renderRefreshedDigests`

Prints those counts and fingerprints as ready-to-paste code for both places
that record them.

## `task9ChangedPathManifest`

Returns only the sorted dedicated-delete and shared-unwind paths for Task 9.

## `validateReviewedPhaseBAcceptanceClassification`

Checks a proposed inventory against the compact reviewed Task 1-8 fingerprint.
Removing or reclassifying any path fails without maintaining a second path list.

## `runCleanupInventoryCli`

Prints the manifest for `--print-task-9-paths` and the refreshed fingerprints
for `--refresh-digests`. Every other argument set fails without diagnostic
output.
