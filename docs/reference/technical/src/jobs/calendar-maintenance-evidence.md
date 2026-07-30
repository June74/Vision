# `src/jobs/calendar-maintenance-evidence.ts`
## `canonicalScheduledInstant`
Requires canonical scheduled UTC.

Defines the closed `vision.calendar-maintenance/v1` schema used by the
production scheduler and safe-tail observer. The schema carries only outcome
enums and cannot carry owner, calendar, channel, provider, event, or error
values.

## `createCalendarMaintenanceEvidence`

Maps repair and renewal terminal enums to `none`, `repair_failed`,
`renewal_failed`, or `repair_and_renewal_failed`, reconstructs exactly five
keys, and freezes the result.

## `emitCalendarMaintenanceEvidence`

Wraps closed evidence in the fixed `calendar.maintenance` action before
calling the replaceable output boundary.
