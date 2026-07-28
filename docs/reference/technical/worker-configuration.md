# `worker-configuration.d.ts`

This declaration is generated locally by Wrangler from `wrangler.jsonc` and runtime type definitions. It records `VISION_ENV` as the literal `local` deployment variable and binds the Worker entry module. It contains no API keys, provider tokens, database URLs, or encryption material.

`wrangler.jsonc` pins `DATABASE_USAGE_WARNING_BYTES=400000000`,
`R2_USAGE_WARNING_BYTES=8000000000`, and
`R2_USAGE_WARNING_OBJECTS=100` in local, preview, and production. Runtime
validation requires positive safe integers in preview and production, while
the generated preview-artifact validator requires the exact approved values.
These non-secret values remain server-only: the client binding boundary and
release scan reject their names from built client assets.

The production diagnostic dependency creates a bounded usage source over the
canonical database and private backup bucket. PostgreSQL uses only
`pg_database_size(current_database())`. R2 lists only `backups/v1/` with a
100-object page limit, a ten-page cap, bounded cursor progress, safe-integer
size admission, and overflow checks before aggregation. The repository reads
the resulting booleans only after owner authentication and keeps the existing
public response keys. A failed provider measurement maps to that provider's
actionable warning without exposing raw failure detail.
