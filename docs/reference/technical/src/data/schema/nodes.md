# `src/data/schema/nodes.ts`

The common node registry is Vision's authoritative envelope. Identity uses explicit columns, never JSON; protected payloads are absent.

## `ciphertext`

Defines a Drizzle custom type with `Uint8Array` input/output and PostgreSQL `bytea` storage.

## `dataType`

Returns PostgreSQL `bytea` for Drizzle migration generation.

## `nodes`

Defines owner-scoped uniqueness keys for typed tables and graph edges. Reviewed SQL enforces closed values, lifecycle ordering, inferred-confidence pairing, and positive versions.
