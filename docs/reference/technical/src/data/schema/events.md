# `src/data/schema/events.ts`

Events link planning-safe fields to an event node. Provider identity, version, recurrence and timing are explicit; protected content uses `bytea` envelopes.

## `events`

Defines the event table and unique provider identity. Reviewed SQL requires a same-owner event node and rejects invalid time ranges/statuses.
