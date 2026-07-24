# `src/data/db.ts`

This file makes Vision's server-only database connection.

## `preserveCanonicalByteaText`

Keeps encrypted database bytes in PostgreSQL's standard hexadecimal text form. This lets Vision validate and copy
the bytes itself instead of trusting a driver-specific byte container.

## `getTypeParser`

Selects the parser Neon should use for each database value. It preserves `bytea` text for Vision's strict decoder and
uses Neon's normal parser for every other data type.

## `createDb`

`createDb(databaseUrl: unknown)` checks the Worker's private database URL at the point where it enters the database
module, then makes a typed Neon client. It accepts only the restricted `vision_app` database role. Invalid or
privileged URLs fail without printing the secret URL or its credentials.
