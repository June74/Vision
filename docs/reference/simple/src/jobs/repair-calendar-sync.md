# `src/jobs/repair-calendar-sync.ts`

Creates ordinary queue work for calendars whose latest successful sync is stale or missing.

## `repairCalendarSync`
Reserves and sends one opaque repair message per eligible calendar. Returns
`reserved` when this run selected durable work and `no_work` otherwise.
## `repairJobId`
Creates a stable job ID for a calendar, checkpoint, and 15-minute slot.
## `assertDate`
Rejects invalid repair timestamps.
