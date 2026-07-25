# `src/data/repositories/channel-maintenance-repository.ts`

This repository keeps lifecycle transitions in PostgreSQL and reuses the claim-guarded job repository for repairs.

## `listRenewalCandidates`
Selects connected calendars with no active channel or expiration within 24 hours and suppresses duplicate pending work.
## `preRegister`
Inserts the channel ID, digest, encrypted token envelope, and provisional expiry before `events.watch`.
## `activate`
Compare-and-sets a pending row, accepting only a null or identical early-bound resource.
## `retire`
Changes only the exact active old row after provider stop.
## `recordFailure`
Increments content-free metadata and exposes bounded Action required.
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
## `readText`
Rejects empty or oversized SQL text.
## `readDate`
Rejects invalid timestamps.
## `readNonNegativeInteger`
Rejects invalid failure counts.
## `readPositiveInteger`
Rejects version-zero repair candidates.
