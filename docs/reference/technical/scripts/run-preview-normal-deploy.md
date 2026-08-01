# run-preview-normal-deploy

Implements the permanent post-cleanup normal preview deployment verifier. It
imports the permanent safe-Git adapter and has no dependency on a temporary
observer, controller, acceptance selector, or acceptance context.

## `runPreviewNormalDeploy`

Snapshots the exact branch/commit input, records paired UTC and monotonic start
times, and calls the safe-Git adapter immediately before dispatch. It requires
one complete provider result bounded by the exact dispatch start/completion
arguments and exactly one run created inside that closed interval. Historical
runs outside the interval are ignored; missing completeness proof, pagination
residue, or multiple in-window runs fail closed. It then requires immutable
commit attribution, a successful run and named deploy job, one unexpired
fixed-name artifact, and the exact five-key attribution schema. Job and
attribution start times cannot precede the containing run creation. Run and
artifact identifiers remain in process memory. The return value is only
`{ outcome, startedAt, completedAt }`.

## `invokeProvider`

Calls the injected provider seam with a frozen argument array. It requires an
exact zero-exit command result, bounded string streams, and one JSON-object
line. Child errors, stream content, arguments, and parsed provider data never
enter the public error.

## `readInput`

Requires exactly `reviewedBranch` and `reviewedCommit`, the fixed branch
literal, and the canonical lowercase 40-hex grammar.

## `readRun`

Requires the exact run metadata keys, a positive decimal in-memory handle,
canonical commit, and canonical creation/completion timestamps.

## `assertRunAttribution`

Checks the fixed workflow path, `workflow_dispatch` event, and exact reviewed
head commit.

## `sameRun`

Compares the opaque identity, workflow, event, head commit, and creation time
between list and read responses so later metadata cannot describe another run.

## `readJob`

Requires the exact job name/status/conclusion and start/completion timestamp
fields. The caller then proves successful settlement inside the run interval.

## `readArtifact`

Requires one positive decimal in-memory artifact handle, fixed-name metadata,
expiry Boolean, canonical creation time, and exact containing-run/head binding.

## `readAttribution`

Requires exactly version, outcome, reviewed commit, started time, and completed
time. Extra provider, URL, binding, command, or environment fields fail closed.

## `exactRecord`

Requires an ordinary exact-key object and own enumerable data descriptors.

## `ownData`

Returns one own enumerable data value without invoking an accessor.

## `canonicalCommit`

Requires one complete lowercase 40-hex reviewed commit.

## `canonicalTimestamp`

Requires exact `YYYY-MM-DDTHH:mm:ss.sssZ` syntax, a finite date, and byte-for-
byte `toISOString()` round-trip identity.

## `safeNow`

Validates a dependency-supplied `Date` and returns a canonical defensive copy.

## `safeMonotonic`

Requires a finite nonnegative number used to cap the total verification call.

## `fail`

Throws only `Preview normal deploy failed closed.`.
