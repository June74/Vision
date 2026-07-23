# `src/audit/audit-writer.ts`

This writer sends only a validated privacy-safe audit record to the configured append-only destination. The
production destination writes those facts to PostgreSQL through Drizzle.

## `write`

Checks the event, turns the approved fields into JSON, and appends that JSON. Rejected input is never serialized or
sent to the destination.

## `append`

Rechecks serialized audit JSON and inserts only its allowlisted columns into the durable audit table.

## `createAuditWriter`

Builds the production writer with its Drizzle database destination.
