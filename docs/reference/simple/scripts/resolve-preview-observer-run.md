# resolve-preview-observer-run

Finds exactly one current preview workflow observer without printing its
identifier or provider data. One shared family-to-job contract keeps the
workflow, resolver, and state validator on the same exact names.

## `resolvePreviewObserverRun`

Polls every five seconds across the complete two-minute horizon. Once the
unique run identity appears, it remains selected while expected jobs are still
queued or their listener steps are starting. It returns only after every exact
listener is active on the inclusive terminal poll. Duplicate run identities,
terminal runs, and contradictory job topology fail immediately. Every poll
walks all relevant pages, and every metadata read shares one absolute,
interruptible monotonic deadline. The terminal poll gets one fixed five-second
settlement cap without moving the two-minute observation close.

A queued run is valid only while its required jobs or listeners are still
starting. If all exact listeners are active while the run remains queued, the
provider snapshot contradicts itself and fails immediately.

## `listRelevantRuns`

Walks newest-first pages until a whole provider-second bucket, plus the fixed
three-second local/provider clock-skew allowance, is entirely before the
millisecond dispatch start or a short final page proves completion. Overlapping
boundary seconds and same-second duplicates remain visible. Ten full relevant
pages fail closed rather than silently truncating.

## `readPreviewSignalObserverState`

Checks the fast signal and accepts only an exact canonical provider timestamp
with whole-second UTC precision.

## `readPreviewTwoJobObserverState`

Checks signal and uniqueness separately. It returns no uniqueness close until
a successful provider timestamp supplies an anchor, and rejects uniqueness
completion reported later than the wall time sampled after that provider read.
Each raw provider-derived uniqueness close must stay stable or move forward;
backward evidence fails before the conservative close is cached.

## `readPreviewAiObserverState`

Checks the concurrent AI signal and uniqueness jobs from one metadata read. It
returns only their closed states and the successful signal listener timestamp;
the dynamic uniqueness close remains controller-owned.

## `readPreviewMaintenanceObserverState`

Checks maintenance uniqueness, binds it to the requested scheduled tick, and
requires and preserves provider completion at exactly tick plus two minutes.

## `createGitHubObserverResolutionDependencies`

Builds the live GitHub metadata adapter with argument-array subprocess calls,
bounded captured output, exact run, run-detail, job, and step projections, and
no shell.

## `invoke`

Runs one captured metadata command before its absolute deadline, validates the
exact projected key set, and returns parsed JSON. Every child, size, timeout,
or parse failure becomes the fixed resolver error.

## `jobsFor`

Reads observer jobs against the caller's absolute deadline.

## `callBeforeDeadline`

Gives each metadata call the same deadline and aborts it when time expires.

## `sleepBeforeDeadline`

Keeps polling sleeps inside the same absolute window.

## `stateReadDeadline`

Creates a bounded deadline for a standalone signal or uniqueness read.

## `runCapturedProviderCommand`

Runs the real captured child with both timeout and abort support, then waits
for the child boundary to settle.

## `raceCommandAgainstDeadline`

Gives an injected command a fresh abort signal, aborts it on timeout or caller
cancellation, and waits for that command to settle before failing without
retaining either captured stream.

## `interruptibleSleep`

Ends a pending sleep promptly when its caller aborts.

## `abort`

Cancels one pending poll delay with the fixed safe failure.

## `validatedRunHandle`

Revalidates the process-local positive decimal handle before command assembly.

## `validMonotonic`

Accepts only finite nonnegative monotonic instants.

## `exactJob`

Requires exactly one job with the requested name.

## `expectedJobTopology`

Returns `pending` while exact expected jobs or listeners are starting, and
`active` only when every family listener is independently active. Duplicates,
terminal expected jobs without an active counterpart, and unexpected active
capture jobs fail immediately.

## `observerJobState`

Reduces one job and its listener to `listening`, `succeeded`, or `failed`.

## `exactListener`

Requires one exact allowlisted evidence-printing step.

## `snapshotRuns`

Requires the exact one-key page shape and copies only its bounded run list.

## `snapshotRun`

Requires the exact run keys, whole-second creation timestamp, and positive
decimal handle before copying allowlisted fields.

## `snapshotJobs`

Requires exact job and step keys before copying bounded metadata.

## `matchesRunIdentity`

Checks immutable workflow attribution and overlap between the provider's
whole-second creation bucket, a fixed three-second clock-skew allowance, and
the closed millisecond dispatch interval. Run state is checked separately so an
attributed terminal run fails promptly.

## `validateResolutionInput`

Checks the workflow path, reviewed commit, dispatch interval, family, and
required maintenance tick before provider reads.

## `plainRecord`

Accepts only ordinary provider objects.

## `ownData`

Reads one required own data property without invoking a getter.

## `optionalOwnData`

Reads one optional own data property without invoking a getter.

## `exactKeys`

Rejects missing or extra provider keys.

## `boundedString`

Bounds provider-controlled strings.

## `nullableBoundedString`

Accepts a bounded provider string or `null`.

## `canonicalDate`

Parses only `YYYY-MM-DDTHH:MM:SSZ` when it round-trips to the same real instant.

## `canonicalContextDate`

Parses only exact millisecond UTC context timestamps.

## `validDate`

Checks one real `Date` without coercion.

## `fail`

Returns one safe error.

## `parsePreviewObserverRunArguments`

Accepts only the exact live resolver flags; calendar maintenance alone
requires the scheduled-tick flag. Dispatch bounds and that tick use exact
millisecond UTC precision.

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

## `runPreviewObserverCli`

Runs the same parse-and-resolve path used by the executable and returns only a
fixed success or failure code.

## `main`

Runs the live resolver and keeps the opaque run handle process-local. Success
and failure both produce no provider metadata.


## Controller call boundaries

The resolver and each observer-state reader, including the AI two-job reader,
accept an optional controller call boundary. Its earlier deadline and
cancellation signal control every provider read and poll sleep. A cancelled
call waits for the in-flight bounded operation to settle before it reports
failure. Callers that omit the boundary retain the normal two-minute window.

## Full provider job lists

A full provider job list can contain a generic completed-and-skipped job and a
dedicated active job with the same displayed name. Resolution ignores only the
completed-and-skipped copy. It still requires exactly one non-skipped expected
job, so multiple active or otherwise non-skipped copies fail closed.

## Conservative uniqueness close

The two-job state reader returns `uniquenessClosesAt: null` while neither job
has supplied a successful provider timestamp. A successful signal anchors its
two-minute window, while successful uniqueness anchors the end of its provider
second. Valid provider evidence can move a remembered close later, never
earlier, and includes the provider's one-second timestamp uncertainty.

## `boundedObserverDeadline`

Chooses the earlier valid deadline when a controller boundary is present and
keeps the existing internal deadline when it is absent.

## `linkOuterAbort`

Carries an optional controller cancellation signal into one fresh provider or
sleep operation and removes the link after that operation settles.

## `conservativeUniquenessClose`

Validates provider anchors, remembers them, and only moves the two-job
observer's safe uniqueness close forward. It never substitutes local wall time
for missing provider evidence.
