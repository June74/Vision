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
duplicate found on any page of that last poll fails closed. Run-list, run
detail, and job reads all receive the same absolute monotonic deadline and
abort signal. A poll that begins at the exact 120-second close receives one
fixed five-second settlement cap; this does not renew or move the observation
close.

## `listRelevantRuns`

Requests pages 1 through at most 10, validates non-increasing creation time,
and stops only after a short page or a provider-second bucket whose end is
strictly before the millisecond dispatch start. This keeps every overlapping
boundary bucket and same-second duplicate visible. Reaching the cap with a full
relevant page is treated as truncation and fails closed.

## `readPreviewSignalObserverState`

Reads one non-maintenance signal job and returns its closed state plus the
listener completion timestamp only after success. The timestamp must be the
exact canonical whole-second UTC provider form.

## `readPreviewTwoJobObserverState`

Reads one provider job snapshot and keeps suppression or restore signal and
uniqueness states independent.

## `readPreviewMaintenanceObserverState`

Requires maintenance uniqueness success to complete at exactly the scheduled
tick plus 120 seconds. It returns defensive copies of both the scheduled tick
and the provider completion instant.

## `createGitHubObserverResolutionDependencies`

Constructs the concrete GitHub adapter from a bounded repository name. It uses
`execFile` argument arrays, fixed response limits, hidden child windows, and
captured streams. Every child receives the remaining absolute timeout and
abort signal, so timeout terminates and settles the child boundary. Run-list,
run-detail, job, and step reads each use fixed `--jq` projections; the adapter
never invokes a shell or renders child output.

## `invoke`

Executes one metadata request, races it against the absolute deadline, enforces
captured stdout/stderr bounds, parses stdout as JSON, validates the expected
projection before returning, and maps every execution, timeout, or parse
failure to the sole resolver error.

## `jobsFor`

Snapshots bounded job metadata returned for one opaque handle inside the
caller's absolute deadline.

## `callBeforeDeadline`

Creates one `AbortController`, passes an immutable
`PreviewObserverCallContext` to the metadata dependency, and maps rejection or
timeout to the constant resolver error. The shared monotonic deadline is never
renewed between pages or follow-up reads.

## `sleepBeforeDeadline`

Caps each poll sleep to the remaining shared horizon and passes the same
absolute deadline to the interruptible sleep port.

## `stateReadDeadline`

Anchors a standalone observer-state metadata read to one finite 120-second
absolute horizon.

## `runCapturedProviderCommand`

Uses captured `execFile` with `signal`, remaining `timeout`, fixed kill signal,
hidden windows, and bounded buffers. The promise settles only after the child
callback boundary settles.

## `raceCommandAgainstDeadline`

Races injected command runners against cancellation and remaining time while
discarding both captured streams on failure.

## `interruptibleSleep`

Clears its timer and rejects with the fixed failure when its abort signal
fires.

## `abort`

Clears the pending delay timer and rejects without retaining the provider
failure that triggered cancellation.

## `validatedRunHandle`

Requires the branded handle to remain a positive decimal string before using
it in an argument.

## `validMonotonic`

Rejects negative, infinite, or nonnumeric monotonic values.

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

Requires exactly the ID, event, SHA, creation time, path, status, and conclusion
keys, validates the positive-decimal ID and exact provider-second creation
timestamp, then copies only those fields.

## `snapshotJobs`

Requires exact envelope, job, and step key sets before copying bounded
name/status/conclusion fields and the bounded setup/listener step list without
invoking accessors.

## `matchesRun`

Requires `workflow_dispatch`, the reviewed SHA, exact workflow path, active
status, null conclusion, and overlap between the whole provider-created second
and the inclusive millisecond dispatch interval.

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

## `exactKeys`

Requires exact own-key membership and rejects missing or provider-added keys.

## `boundedString`

Limits each provider-controlled string before retention.

## `nullableBoundedString`

Admits `null` or delegates to the bounded string check.

## `canonicalDate`

Requires `YYYY-MM-DDTHH:MM:SSZ`, a finite parse, and exact round-trip identity
before returning a fresh `Date`. Missing, fractional, lower-precision, or
normalized impossible dates fail closed.

## `canonicalContextDate`

Requires the separate `YYYY-MM-DDTHH:MM:SS.sssZ` context form, a finite parse,
and exact round-trip identity. Provider metadata never uses this parser.

## `validDate`

Recognizes a finite `Date` instance without coercion.

## `fail`

Throws the constant resolver error.

## `parsePreviewObserverRunArguments`

Parses unique live flags for repository, workflow, SHA, dispatch bounds, and
family. Only calendar maintenance admits and requires
`--maintenance-scheduled-at`. Dispatch and maintenance context values use the
millisecond parser; provider metadata retains whole-second parsing.

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

## `runPreviewObserverCli`

Executes the same exported parse-and-resolve path as `main`, discards the
opaque handle, and returns only `0` or `1`.

## `main`

Runs the concrete resolver and deliberately discards the returned handle at the
process boundary. It emits neither run identifiers nor provider responses.
