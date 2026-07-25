# `src/data/repositories/channel-maintenance-repository.ts`

Stores Google channel lifecycle and selects stale calendars for scheduled repair.

## `listRenewalCandidates`
Finds missing or expiring channels.
## `preRegister`
Stores a pending digest-backed channel.
## `activate`
Activates the watched resource.
## `retire`
Retires an old stopped channel.
## `recordFailure`
Records safe counters and Action required.
## `listRepairCandidates`
Finds stale connected calendars.
## `reserveRepairJob`
Durably reserves repair work.
## `markEnqueued`
Records a Queue send.
## `assertOwner`
Rejects work for another owner.
## `createChannelMaintenanceRepository`
Creates the repository.
## `decodeRenewalCandidate`
Validates a renewal row.
## `readText`
Reads an identifier.
## `readDate`
Reads a timestamp.
## `readNonNegativeInteger`
Reads a failure count.
## `readPositiveInteger`
Reads a checkpoint version.
