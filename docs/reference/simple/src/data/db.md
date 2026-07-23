# `src/data/db.ts`

This file makes Vision's server-only database connection.

## `createDb`

`createDb(databaseUrl: unknown)` checks the Worker's private database URL at the point where it enters the database
module, then makes a typed Neon client. It accepts only the restricted `vision_app` database role. Invalid or
privileged URLs fail without printing the secret URL or its credentials.
