# run-preview-normal-deploy

Starts one ordinary preview deployment for an exact reviewed commit and checks
the resulting run, job, and fixed proof artifact without exposing provider
details.

## `runPreviewNormalDeploy`

Checks the fixed remote branch immediately before dispatch, requires a complete
bounded run result with exactly one run inside the dispatch interval, and
returns only `deployed` plus safe start and completion times. Older runs outside
the interval do not make a valid deployment ambiguous.

## `invokeProvider`

Calls one provider operation with an argument array and accepts one bounded
JSON line while discarding both child streams.

## `readInput`

Accepts only the approved branch and one lowercase 40-character commit.

## `readRun`

Copies the exact safe workflow-run fields while keeping its handle private.

## `assertRunAttribution`

Requires the fixed workflow, dispatch event, and reviewed commit.

## `sameRun`

Confirms that the listed and resolved run identify the same immutable dispatch.

## `readJob`

Copies the exact safe containing-job fields. The job cannot start before its
containing workflow run.

## `readArtifact`

Copies the fixed artifact metadata and its run/commit binding.

## `readAttribution`

Copies the exact five-field normal-deployment proof. Its start cannot precede
the containing workflow run.

## `exactRecord`

Requires an ordinary object with exactly the declared own data keys.

## `ownData`

Reads a data property without invoking an accessor.

## `canonicalCommit`

Recognizes a lowercase 40-character reviewed commit.

## `canonicalTimestamp`

Recognizes a millisecond-precision UTC timestamp that round-trips exactly.

## `safeNow`

Copies and validates a wall-clock value supplied by the runner.

## `safeMonotonic`

Accepts a finite nonnegative monotonic-clock value.

## `fail`

Throws the runner's single safe failure message.
