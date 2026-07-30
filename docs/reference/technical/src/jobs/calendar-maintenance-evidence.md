# `src/jobs/calendar-maintenance-evidence.ts`

## `canonicalScheduledInstant`

Requires canonical scheduled UTC.

Defines the closed `vision.calendar-maintenance/v2` schema used by the
production scheduler and safe-tail observer. The schema carries only outcome
enums and cannot carry owner, calendar, channel, provider, event, or error
values.

## `createCalendarMaintenanceEvidence`

Maps repair and renewal terminal enums to `none`, `repair_failed`,
`renewal_failed`, or `repair_and_renewal_failed`, reconstructs exactly the six
keys `evidenceType`, `maintenanceScheduledAt`, `outcome`, `category`,
`repairOutcome`, and `renewalOutcome`, and freezes the result. The scheduled
instant comes from the admitted scheduler tick and is serialized as canonical
UTC.

## `emitCalendarMaintenanceEvidence`

Wraps closed evidence in the fixed `calendar.maintenance` action before
calling the replaceable output boundary.
