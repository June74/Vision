# `src/server/logging.ts`

This module only permits a small, structured set of audit details. It rejects hidden fields, symbols, unusual object types, and descriptions before they can reach a logger.

## `SafeLogEventSchema`

`SafeLogEventSchema` lists the permitted audit fields: request ID, action, outcome, error category, duration, provider, retry count, and opaque UUID entity IDs.

## `SafeLogEvent`

`SafeLogEvent` is a checked audit event with no free-form user content.

## `SafeLogger`

`SafeLogger` receives one checked audit event.

## `logEvent`

`logEvent` accepts only ordinary objects or null-prototype objects. It checks every own key before it calls the supplied logger. Hidden, symbol, and unknown fields cause an error and are not logged.
