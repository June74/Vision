# `src/jobs/queue-message.ts`

`CalendarSyncMessageSchema` is strict so tokens, headers, event content, or accidental extra metadata cannot cross the queue boundary.

## `parseCalendarSyncMessage`

Creates a frozen closed-shape message after Zod validates bounded IDs and the synchronization reason enum.
