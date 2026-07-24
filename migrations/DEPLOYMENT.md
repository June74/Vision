# Migration deployment policy

Only the numbered, reviewed SQL files directly inside this directory are deployable. For the incremental synchronization foundation, the only new deployable migration is `0004_incremental_event_sync.sql`.

`migrations/generated/` contains Drizzle Kit schema-comparison drafts and retained JSON snapshots. Never pass that directory to a migration runner.
