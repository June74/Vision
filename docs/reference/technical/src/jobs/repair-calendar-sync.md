# `src/jobs/repair-calendar-sync.ts`

Scheduled repair uses the same PostgreSQL reservation and Cloudflare Queue path as verified push notifications. The scheduler has no event client and Queue messages contain only opaque IDs.

## `repairCalendarSync`
Selects connected stale calendars, reserves a deterministic job before Queue send, marks it enqueued afterward, and skips duplicates.
## `repairJobId`
Hashes owner/calendar/checkpoint identity with the exact 15-minute slot so repeated invocations converge.
## `assertDate`
Prevents malformed time values from affecting deterministic slots.
