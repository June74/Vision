# `src/audit/audit-writer.ts`

This writer sends only a validated privacy-safe audit record to the configured append-only destination.

## `write`

Checks the event, turns the approved fields into JSON, and appends that JSON. Rejected input is never serialized or
sent to the destination.
