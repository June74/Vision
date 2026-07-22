# `src/server/logging.ts`

This module owns the audit-event boundary. It validates an unknown input with Zod before dispatching it to an injected `SafeLogger`; it does not serialize unvalidated input.

## `SafeLogEventSchema`

`SafeLogEventSchema` is a strict Zod object containing only `requestId`, `action`, `outcome`, optional `errorCategory`, `durationMs`, `provider`, `retryCount`, `entityId`, and `entityIds`. Entity values are opaque identifiers; callers must not place names or descriptions in them.

## `SafeLogEvent`

`SafeLogEvent` is inferred from `SafeLogEventSchema`, so the logger contract matches runtime validation.

## `SafeLogger`

`SafeLogger` is `(event: SafeLogEvent) => void`, allowing tests and production to choose a sink without global mutation.

## `logEvent`

**Signature:** `logEvent(logger: SafeLogger, event: unknown): void`

The function checks object keys against the allowlist before parsing. If an unsupported key exists it throws `Unsupported audit field: <key>` without reading or serializing its value. Otherwise it parses with the strict schema and calls `logger` exactly once with the validated event.
