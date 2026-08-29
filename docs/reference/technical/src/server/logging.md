# `src/server/logging.ts`

This module owns the audit-event boundary. It validates an unknown input with Zod before dispatching it to an injected `SafeLogger`; it does not serialize unvalidated input.

## `SafeLogEventSchema`

`SafeLogEventSchema` is a strict Zod object containing only `requestId`, `action`, `outcome`, optional `errorCategory`, optional `diagnosticStage`, `durationMs`, `provider`, `retryCount`, `entityId`, and `entityIds`. `entityId` and every `entityIds` member must be UUIDs, preventing names and descriptions from entering the sink. `diagnosticStage` is the temporary preview-only authentication failure category and is a `z.enum` over the closed `AUTH_DIAGNOSTIC_STAGES` set, so it can only ever carry a literal authored in `src/server/auth/diagnostics.ts`.

## `SafeLogEvent`

`SafeLogEvent` is inferred from `SafeLogEventSchema`, so the logger contract matches runtime validation.

## `SafeLogger`

`SafeLogger` is `(event: SafeLogEvent) => void`, allowing tests and production to choose a sink without global mutation.

## `logEvent`

**Signature:** `logEvent(logger: SafeLogger, event: unknown): void`

The function accepts only records whose direct prototype is `Object.prototype` or `null`. It inspects `Reflect.ownKeys` and each property descriptor before parsing, rejecting symbols, non-enumerable keys, and unallowlisted keys without reading their values. It then parses with the strict schema and calls `logger` exactly once with the validated event.
