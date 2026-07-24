# `src/jobs/queue-message.ts`

Calendar queue messages contain only opaque job, owner, and calendar IDs plus a reason.

## `parseCalendarSyncMessage`

Rejects missing, oversized, or extra fields before a queue job is claimed.
