# `src/data/db.ts`

This module creates the typed Drizzle Neon HTTP database.

## `createDb`

**Signature:** `(databaseUrl: unknown) => VisionDatabase`

Treats the raw Worker binding as untrusted boundary input and passes it through `parseVisionDatabaseUrl` before
constructing the Neon HTTP and Drizzle clients. The parser requires a valid PostgreSQL URL using the dedicated
`vision_app` role and rejects privileged roles such as `neondb_owner`. Validation errors use fixed schema messages
and never echo the secret URL, credentials, query parameters, or database contents.
