# Generated schema drafts

Files in this directory are Drizzle Kit comparison artifacts only. They are not reviewed deployment migrations and must never be applied to a database.

The deployable migration sequence is the reviewed SQL at `migrations/0001_*.sql` through `migrations/0007_calendar_maintenance_state.sql`. Generated SQL carries the `.sql.draft` suffix so migration runners cannot mistake it for deployable input.
