# Migration deployment policy

Only the numbered, reviewed SQL files directly inside this directory are deployable. The synchronization foundation uses `0004_incremental_event_sync.sql`, `0005_google_notification_jobs.sql`, `0006_google_channel_lifecycle.sql`, then `0007_calendar_maintenance_state.sql` for race-safe channel renewal, durable election/failure state, bootstrap, and scheduled repair.

`migrations/generated/` contains Drizzle Kit schema-comparison drafts and retained JSON snapshots. Never pass that directory to a migration runner.
