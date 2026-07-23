# `src/audit/audit-writer.ts`

`AuditEventSink` is the injected append-only persistence port. `AuditWriter` owns validation and serialization so
sinks never receive unknown objects or rejected values. Its generic exact-key signature rejects extra keys on both
fresh literals and inferred variables. `DrizzleAuditEventSink` is the production durable implementation.

## `write`

**Signature:** `(event: SafeAuditEvent) => Promise<void>`

Runs `validateSafeAuditEvent`, serializes only its normalized result with `JSON.stringify`, then awaits
`AuditEventSink.append`. Validation occurs before serialization and before the only external side effect.

## `append`

**Signature:** `(serializedEvent: string) => Promise<void>`

Parses and revalidates the serialized value, converts the validated timestamp to `Date`, and executes one parameterized
Drizzle SQL insert containing only the nine reviewed audit columns.

## `createAuditWriter`

**Signature:** `(database: VisionDatabase) => AuditWriter`

Wires `AuditWriter` to `DrizzleAuditEventSink`; no caller can accidentally select a non-durable default.
