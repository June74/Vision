# `src/data/repositories/job-repository.ts`

This repository stores verified notification jobs and prevents duplicate queue deliveries from running the same sync twice.

## `findGoogleChannel`

Finds a channel only when its Google channel ID and hashed secret token both match and its checkpoint is connected.

## `bindPendingGoogleChannelResource`

Binds Google's first authenticated `sync` resource to a pending channel.

## `inspectWebhookReplay`

Checks whether an opaque notification job already exists without changing it. It returns only `new` or `replay` and rejects an identity collision.

## `reserveWebhookJob`

Creates one durable job for a notification or returns the existing job for the same signal.

## `markEnqueued`

Records that the first queue send completed.

## `claimJob`

Atomically gives one queue delivery permission to run the job.

## `completeJob`

Stores safe counts and the checkpoint version after synchronization succeeds.

## `scheduleRetry`

Releases the claim and records a safe retry category.

## `failJob`

Records a terminal failure and whether the user must act.

## `finishClaimedFailure`

Updates calendar health and job disposition together only while the exact lease still owns the job.

## `finishFailure`

Applies the shared claim-protected failure update.

## `createCalendarJobRepository`

Creates the PostgreSQL-backed repository.

## `decodeChannel`

Validates queryable channel facts returned by the database.

## `readChannelLifecycle`

Accepts only pending or active webhook channels.

## `decodeMessage`

Validates the four opaque queue fields returned by the database.

## `readText`

Rejects empty or non-text database values.

## `readHash`

Requires a canonical SHA-256 base64url digest.

## `readPositiveInteger`

Reads a positive safe integer from a database value.

## `readNonNegativeInteger`

Reads a checkpoint generation, including the initial zero generation.

## `readDate`

Reads a genuine or offset-bearing timestamp.

## `assertAttempt`

Bounds queue delivery attempts before SQL use.

## `assertClaimId`

Bounds an opaque job lease identifier.

## `assertDate`

Rejects invalid repository timestamps.
