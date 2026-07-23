# `src/data/db.ts`

This module creates the typed Drizzle Neon HTTP database.

## `createDb`

**Signature:** `(databaseUrl: string) => VisionDatabase`

Builds a typed client from a Worker secret. Production must use a least-privileged application role, never `neondb_owner`.
