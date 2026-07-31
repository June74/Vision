# resolve-preview-observer-run

Finds exactly one current preview workflow observer without printing its
identifier or provider data. One shared family-to-job contract keeps the
workflow, resolver, and state validator on the same exact names.

## `resolvePreviewObserverRun`

Polls every five seconds for one correctly attributed observer and requires
the same active run to be observed twice within the two-minute resolution
window. Every poll walks all relevant run-list pages before deciding
uniqueness.

## `listRelevantRuns`

Walks newest-first pages until creation time crosses the dispatch start or a
short final page proves completion. Ten full relevant pages fail closed rather
than silently truncating.

## `readPreviewSignalObserverState`

Checks the fast signal.

## `readPreviewTwoJobObserverState`

Checks signal and uniqueness separately.

## `readPreviewMaintenanceObserverState`

Checks maintenance uniqueness and binds it to the requested scheduled tick.

## `createGitHubObserverResolutionDependencies`

Builds the live GitHub metadata adapter with argument-array subprocess calls,
bounded captured output, exact page projection, and no shell.

## `invoke`

Runs one captured metadata command and returns parsed JSON; every child,
size, or parse failure becomes the fixed resolver error.

## `jobsFor`

Reads the observer jobs.

## `exactJob`

Requires exactly one job with the requested name.

## `assertExpectedActiveJobs`

Requires every job for the family to be independently active and rejects an
unexpected active capture job.

## `observerJobState`

Reduces one job and its listener to `listening`, `succeeded`, or `failed`.

## `exactListener`

Requires one exact allowlisted evidence-printing step.

## `snapshotRuns`

Requires the exact one-key page shape and copies only its bounded run list.

## `snapshotRun`

Copies the allowlisted fields of one provider run.

## `snapshotJobs`

Copies bounded job and listener-step metadata.

## `matchesRun`

Checks workflow attribution.

## `validateResolutionInput`

Checks the workflow path, reviewed commit, dispatch interval, family, and
required maintenance tick before provider reads.

## `plainRecord`

Accepts only ordinary provider objects.

## `ownData`

Reads one required own data property without invoking a getter.

## `optionalOwnData`

Reads one optional own data property without invoking a getter.

## `boundedString`

Bounds provider-controlled strings.

## `nullableBoundedString`

Accepts a bounded provider string or `null`.

## `canonicalDate`

Parses a timestamp.

## `validDate`

Checks one real `Date` without coercion.

## `fail`

Returns one safe error.

## `parseArguments`

Accepts only the exact live resolver flags; calendar maintenance alone
requires the scheduled-tick flag.

## `monotonicNow`

Supplies the poll clock.

## `sleep`

Waits between bounded metadata reads.

## `listRuns`

Lists one numbered page of workflow-dispatch runs.

## `readRun`

Reads one selected run again for stable attribution.

## `listJobs`

Lists the selected run's jobs.

## `main`

Runs the live resolver and keeps the opaque run handle process-local. Success
and failure both produce no provider metadata.
