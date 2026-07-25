# Migration deployment policy

Only the numbered, reviewed SQL files directly inside this directory are deployable. The synchronization foundation uses `0004_incremental_event_sync.sql`, `0005_google_notification_jobs.sql`, `0006_google_channel_lifecycle.sql`, `0007_calendar_maintenance_state.sql`, then `0008_google_projection_rebuild.sql` for encrypted full-list staging plus Vision-owned annotation and category-provenance records. `0009_ai_usage_budget.sql` adds content-free AI reservation, settlement, and one-owner concurrency state.

`migrations/generated/` contains Drizzle Kit schema-comparison drafts and retained JSON snapshots. Never pass that directory to a migration runner.
