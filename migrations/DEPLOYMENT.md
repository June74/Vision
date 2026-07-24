# Migration deployment policy

Only the numbered, reviewed SQL files directly inside this directory are deployable. The synchronization foundation uses `0004_incremental_event_sync.sql`, followed by `0005_google_notification_jobs.sql` for verified notification and queue state.

`migrations/generated/` contains Drizzle Kit schema-comparison drafts and retained JSON snapshots. Never pass that directory to a migration runner.
