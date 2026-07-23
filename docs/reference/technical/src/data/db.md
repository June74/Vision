# `src/data/db.ts`

This module creates the typed Drizzle Neon HTTP database.

## `createDb`

**Signature:** `(environment: RuntimeEnv) => VisionDatabase`

Builds a typed client only from `RuntimeEnvSchema` output. The schema safely parses the secret URL and accepts only the `vision_app` username, rejecting `neondb_owner` without exposing the URL.
