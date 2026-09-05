# `src/data/repositories/channel-maintenance-repository.ts`

Stores Google channel lifecycle and selects stale calendars for scheduled repair.

## `bootstrapConnectedCalendars`
Creates missing version-zero sync state and one initial job from the connected Vision calendar.
## `listRenewalCandidates`
Finds missing or expiring channels.
## `preRegister`
Stores a pending digest-backed channel.
## `bindWatchedResource`
Stores the exact watched resource before activation so a crash can still clean it up.
## `activate`
Activates the watched resource.
## `retire`
Retires an old stopped channel.
## `recordFailure`
Records safe counters and Action required.
## `recordCredentialFailure`
Records a safe scheduler credential state only for a connected checkpoint or Vision's exact existing scheduler marker.
## `recoverAuthorizationAfterReconnect`
After a successful reconnect, clears only an older complete scheduler-owned authorization marker. It returns `not_needed` for ordinary first login or unrelated health, and `conflict` for ambiguous or newer state.

Normal synchronization can move ahead of the maintenance record. If the calendar
is already connected and has no saved credential-failure marker, that older
maintenance version does not block login and nothing is rewritten. Account,
calendar, setup, and fresh-token checks still apply. A maintenance version ahead
of the checkpoint, a saved marker, or a disconnected calendar does not qualify.

An optional diagnostic observer receives one fixed reason when the result is
`conflict`. It reads the same locked database snapshot as the decision, not a
second query. Reasons contain no account values, tokens, or timestamps. Unknown
reasons become `unclassified`; a broken observer cannot change the outcome.
Successful recovery and `not_needed` never notify the observer.
## `clearCredentialRetry`
Reconnects only a retry that the scheduler marked after a credential problem.
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
