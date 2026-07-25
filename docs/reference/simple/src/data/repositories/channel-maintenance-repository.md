# `src/data/repositories/channel-maintenance-repository.ts`

Stores Google channel lifecycle and selects stale calendars for scheduled repair.

## `bootstrapConnectedCalendars`
Creates missing version-zero sync state and one initial job from the connected Vision calendar.
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
## `markCleanupRequired`
Remembers an old channel that Google still needs to stop.
## `listSupersededChannels`
Finds every old non-current channel whose provider cleanup must be completed.
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
## `decodeActiveChannel`
Validates an exact active channel identity.
## `stableId`
Creates a repeatable content-free identifier.
## `readText`
Reads an identifier.
## `readDate`
Reads a timestamp.
## `readNonNegativeInteger`
Reads a failure count.
## `readPositiveInteger`
Reads a checkpoint version.
## `readBoolean`
Reads a strict database boolean.
