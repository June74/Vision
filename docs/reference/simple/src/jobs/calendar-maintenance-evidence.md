# `src/jobs/calendar-maintenance-evidence.ts`

Creates one permanent, value-free result for the normal 15-minute calendar
maintenance schedule.

## `createCalendarMaintenanceEvidence`

Combines repair and renewal outcomes into one exact five-field success or
failure result without including counts, identifiers, or error text.

## `emitCalendarMaintenanceEvidence`

Writes only `{ action: "calendar.maintenance", evidence }`.
