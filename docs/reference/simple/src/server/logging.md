# `src/server/logging.ts`

This module only permits a small, structured set of audit details. It rejects fields such as descriptions before they can reach a logger.

## `SafeLogEventSchema`

`SafeLogEventSchema` lists the permitted audit fields: request ID, action, outcome, error category, duration, provider, retry count, and opaque entity IDs.

## `SafeLogEvent`

`SafeLogEvent` is a checked audit event with no free-form user content.

## `SafeLogger`

`SafeLogger` receives one checked audit event.

## `logEvent`

`logEvent` checks an event before it calls the supplied logger. Unknown fields cause an error and are not logged.
