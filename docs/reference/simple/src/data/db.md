# `src/data/db.ts`

This file makes Vision's server-only database connection.

## `preserveCanonicalByteaText`

Keeps encrypted database bytes in PostgreSQL's standard hexadecimal text form. This lets Vision validate and copy
the bytes itself instead of trusting a driver-specific byte container.

## `createDb`

`createDb(databaseUrl: unknown)` checks the Worker's private database URL at the point where it enters the database
module, registers Vision's `bytea` text handling with Neon, then makes a typed client. It accepts only the restricted
`vision_app` database role. Invalid or privileged URLs fail without printing the secret URL or its credentials.
