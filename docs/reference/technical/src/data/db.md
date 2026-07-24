# `src/data/db.ts`

This module creates the typed Drizzle Neon HTTP database.

## `preserveCanonicalByteaText`

**Signature:** `(value: string) => string`

Returns Neon's canonical PostgreSQL `bytea` text unchanged so the repository boundary can perform its existing
strict hexadecimal validation and defensive copy.

## `createDb`

**Signature:** `(databaseUrl: unknown) => VisionDatabase`

Treats the raw Worker binding as untrusted boundary input and passes it through `parseVisionDatabaseUrl` before
constructing the Neon HTTP and Drizzle clients. The parser requires a valid PostgreSQL URL using the dedicated
`vision_app` role and rejects privileged roles such as `neondb_owner`. Before creating the HTTP client, it registers
the text parser for PostgreSQL OID 17 (`bytea`) through Neon's active global parser registry. This preserves canonical
hexadecimal text for encrypted rows while leaving all unrelated type parsers unchanged. Validation errors use fixed
schema messages and never echo the secret URL, credentials, query parameters, or database contents.
