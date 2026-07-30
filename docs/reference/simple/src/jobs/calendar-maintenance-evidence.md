# `src/jobs/calendar-maintenance-evidence.ts`

## `canonicalScheduledInstant`

Records scheduled UTC.

Creates one permanent, value-free result for the normal 15-minute calendar
maintenance schedule.

## `createCalendarMaintenanceEvidence`

Combines repair and renewal outcomes into one exact six-field
`vision.calendar-maintenance/v2` success or failure result. The fields are
`evidenceType`, `maintenanceScheduledAt`, `outcome`, `category`,
`repairOutcome`, and `renewalOutcome`; counts, identifiers, and error text are
not allowed.

## `emitCalendarMaintenanceEvidence`

Writes only `{ action: "calendar.maintenance", evidence }`.
