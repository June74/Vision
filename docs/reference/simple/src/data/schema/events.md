# `src/data/schema/events.ts`

This table keeps calendar timing and provider identity separate from encrypted event details.

## `events`

`events` stores one event per provider, calendar, and event ID. Private content is kept in byte envelopes.
