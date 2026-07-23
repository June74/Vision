# `src/audit/audit-writer.ts`

`AuditEventSink` is the injected append-only persistence port. `AuditWriter` owns validation and serialization so
sinks never receive unknown objects or rejected values.

## `write`

**Signature:** `(event: SafeAuditEvent) => Promise<void>`

Runs `validateSafeAuditEvent`, serializes only its normalized result with `JSON.stringify`, then awaits
`AuditEventSink.append`. Validation occurs before serialization and before the only external side effect.
