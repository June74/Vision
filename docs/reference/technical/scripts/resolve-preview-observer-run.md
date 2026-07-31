# resolve-preview-observer-run

Provides bounded Actions metadata resolution using immutable commit, workflow,
event, dispatch interval, and exact job-set checks. The exported
`PREVIEW_OBSERVER_JOB_CONTRACT` is the single family-to-job-name vocabulary
shared with the captured-state validator.

## `resolvePreviewObserverRun`

Polls at five-second intervals for at most 120 seconds. It requires zero or one
matching run per read, re-reads the selected run, validates every expected
listener job, and normally retains the same candidate across observations.
Only a run first discovered on the inclusive terminal poll may use one complete
observation. All 24 sleeps and the terminal page walk still occur, and a
duplicate found on any page of that last poll fails closed.

## `listRelevantRuns`

Requests pages 1 through at most 10, validates non-increasing creation time,
and stops only after a short page or a run older than the dispatch start.
Reaching the cap with a full relevant page is treated as truncation and fails
closed.

## `readPreviewSignalObserverState`

Reads one non-maintenance signal job and returns its closed state plus the
listener completion timestamp only after success. The timestamp must be the
exact canonical whole-second UTC provider form.

## `readPreviewTwoJobObserverState`

Reads one provider job snapshot and keeps suppression or restore signal and
uniqueness states independent.

## `readPreviewMaintenanceObserverState`

Requires maintenance uniqueness success to complete no earlier than the
scheduled tick plus 120 seconds and no later than the inclusive tick plus
240-second settlement deadline, then returns a defensive copy of that tick.

## `createGitHubObserverResolutionDependencies`

Constructs the concrete GitHub adapter from a bounded repository name. It uses
`execFile` argument arrays, fixed response limits, hidden child windows, and
captured streams. Run-list calls include the exact page number and a fixed
`--jq` projection; the adapter never invokes a shell or renders child output.

## `invoke`

Executes one metadata request, enforces captured stdout/stderr bounds, parses
stdout as JSON, and maps every execution or parse failure to the sole resolver
error.

## `jobsFor`

Snapshots bounded job metadata returned for one opaque handle.

## `exactJob`

Rejects absent or duplicated exact job names.

## `assertExpectedActiveJobs`

Requires all jobs in the shared family contract to have one active listener
and rejects any other in-progress `Capture ...` job.

## `observerJobState`

Admits only the exact active or successful job/listener pairs; completed
non-success states become `failed`, and ambiguous provider states fail closed.

## `exactListener`

Requires exactly one step named `Print only allowlisted acceptance evidence`.

## `snapshotRuns`

Requires an ordinary response with exactly one `workflow_runs` key and an
array within the per-page count limit.

## `snapshotRun`

Copies only bounded ID, event, SHA, creation time, path, status, and conclusion
fields and validates the positive-decimal ID.

## `snapshotJobs`

Copies only bounded name/status/conclusion fields and the bounded setup/listener
step list without invoking accessors.

## `matchesRun`

Requires `workflow_dispatch`, the reviewed SHA, exact workflow path, active
status, null conclusion, and creation within the inclusive dispatch interval.

## `validateResolutionInput`

Requires the exact preview workflow path, lowercase reviewed SHA, valid ordered
dispatch `Date` values, a closed family, and a valid maintenance tick for the
maintenance family.

## `plainRecord`

Rejects arrays, nulls, and custom prototypes at provider boundaries.

## `ownData`

Reads one required enumerable own data descriptor without invoking accessors.

## `optionalOwnData`

Reads one optional enumerable own data descriptor and rejects accessors.

## `boundedString`

Limits each provider-controlled string before retention.

## `nullableBoundedString`

Admits `null` or delegates to the bounded string check.

## `canonicalDate`

Requires `YYYY-MM-DDTHH:MM:SSZ`, a finite parse, and exact round-trip identity
before returning a fresh `Date`. Missing, fractional, lower-precision, or
normalized impossible dates fail closed.

## `validDate`

Recognizes a finite `Date` instance without coercion.

## `fail`

Throws the constant resolver error.

## `parseArguments`

Parses unique live flags for repository, workflow, SHA, dispatch bounds, and
family. Only calendar maintenance admits and requires
`--maintenance-scheduled-at`.

## `monotonicNow`

Provides the resolution timeout clock.

## `sleep`

Implements the five-second poll interval.

## `listRuns`

Calls one numbered workflow-run listing page through the captured adapter.

## `readRun`

Re-reads the selected run by opaque handle.

## `listJobs`

Calls the selected run's job listing endpoint through the captured adapter.

## `main`

Runs the concrete resolver and deliberately discards the returned handle at the
process boundary. It emits neither run identifiers nor provider responses.
