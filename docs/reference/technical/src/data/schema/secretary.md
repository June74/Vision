# `src/data/schema/secretary.ts`

Drizzle schema for migrations `0012_phase_c_secretary_local.sql` and
`0013_phase_c_planning_follow_ups.sql`. The four tables are additive and owner-scoped. User-authored content uses the existing
`ciphertext` custom type; only safe classification/lifecycle/time metadata is
queryable.

## `secretaryCaptures`

**Table:** `secretary_captures`

Requires nonempty owner, allowlisted capture kind/ambiguity, encrypted content,
and monotonic timestamps.

## `secretaryTasks`

**Table:** `secretary_tasks`

Requires nonempty owner/timezone, encrypted title, open/completed lifecycle, and
status/completion consistency.

## `secretaryNotes`

**Table:** `secretary_notes`

Requires encrypted title/body, active status, owner scope, and monotonic
timestamps.

## `secretaryFollowUps`

**Table:** `secretary_follow_ups`

Requires encrypted title/source IDs, owner/timezone scope, and consistent
open/snoozed/completed metadata.
