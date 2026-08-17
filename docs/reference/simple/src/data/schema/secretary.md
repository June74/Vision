# `src/data/schema/secretary.ts`

Defines the additive local-secretary tables. Capture content, task titles, and
note fields are encrypted; owner, timestamps, timezone, lifecycle, and capture
classification remain bounded query metadata.

## `secretaryCaptures`

Stores owner-scoped encrypted capture content and deterministic classification.

## `secretaryTasks`

Stores encrypted task titles with due time, timezone, and reversible status.

## `secretaryNotes`

Stores encrypted note title/body with active status and timestamps.
