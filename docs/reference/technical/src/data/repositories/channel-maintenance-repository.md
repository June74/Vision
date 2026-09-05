# `src/data/repositories/channel-maintenance-repository.ts`

This repository keeps lifecycle transitions in PostgreSQL and reuses the claim-guarded job repository for repairs.

## `bootstrapConnectedCalendars`
Atomically derives version-zero checkpoint, maintenance, and deterministic initial-job state from the canonical connected setup row.
## `listRenewalCandidates`
Selects canonical connected calendars with no current active channel or expiration within 24 hours and excludes an active renewal lease.
## `preRegister`
Inserts the channel ID, digest, encrypted token envelope, and provisional expiry before `events.watch`.
## `bindWatchedResource`
Compare-and-sets the provider resource onto the exact pending lease before activation, preserving cleanup identity across a Worker crash.
## `activate`
Compare-and-sets a pending row, accepting only a null or identical early-bound resource.
## `retire`
Changes only the exact active old row after provider stop.
## `recordFailure`
Increments the calendar-level durable failure counter for the exact lease and exposes bounded Action required.
## `recordCredentialFailure`
Atomically writes a typed scheduler credential disposition only from connected state or an exact version/category/timestamp scheduler marker, so Task 3 retry state cannot be adopted.
## `recoverAuthorizationAfterReconnect`
Locks the exact owner token, setup, canonical connection, checkpoint, and maintenance rows in one SQL statement. It requires exact token metadata plus a complete older `disconnected / authorization` scheduler marker, clears checkpoint and marker together, advances timestamps without moving maintenance time backward, and forces statement rollback if the two guarded updates do not both affect one row.

An already-connected checkpoint with all three credential marker fields null also
admits an older maintenance checkpoint snapshot as `not_needed`, without changing
any row. This accounts for sync commits advancing independently of maintenance.
Exact owner/subject/calendar/setup and token version/time guards remain mandatory;
ahead-of-checkpoint maintenance, any marker, and non-connected lag remain conflicts.
Actual authorization recovery still requires equal checkpoint versions.

The optional `AuthorizationRecoveryConflictObserver` receives an authored member
of `AUTHORIZATION_RECOVERY_CONFLICT_REASONS` only after a valid `conflict` result.
The final SQL projection classifies the first failing token, topology, or marker
predicate from existing materialized locked CTEs. Admission/update CTEs and the
outcome decoder are unchanged; there is no additional query or diagnostic write.
Null-safe comparisons retain missing-marker distinctions. The decoder selects
only a literal from the tuple, defaulting malformed reasons to `unclassified`.
Notification exceptions are ignored so an observer cannot affect authorization.
Only the preview callback opts in; accepted results never notify.
## `clearCredentialRetry`
Returns only an exact scheduler-marked transient or database retry to connected after credential resolution succeeds.
## `markCleanupRequired`
Marks an exact superseded active row for later provider-stop retry.
## `listSupersededChannels`
Returns every non-current active row so both newly marked and pre-migration duplicates receive exact provider-stop cleanup.
## `listRepairCandidates`
Uses only latest `sync_runs.completed_at` and a 15-minute threshold.
## `reserveRepairJob`
Reuses webhook reservation semantics.
## `markEnqueued`
Transitions only after Queue send.
## `assertOwner`
Enforces the single private owner before SQL or provider work.
## `createChannelMaintenanceRepository`
Constructs the SQL repository.
## `decodeRenewalCandidate`
Decodes only queryable lifecycle facts.
## `decodeActiveChannel`
Strictly decodes the exact channel and provider resource pair required by `channels.stop`.
## `stableId`
Hashes canonical owner/calendar/version inputs into a content-free deterministic ID.
## `readText`
Rejects empty or oversized SQL text.
## `readDate`
Rejects invalid timestamps.
## `readNonNegativeInteger`
Rejects invalid failure counts.
## `readPositiveInteger`
Rejects version-zero repair candidates.
## `readBoolean`
Rejects non-boolean SQL results.
