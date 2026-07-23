# `src/audit/audit-event.ts`

`SafeAuditEventSchema` is a strict Zod object. IDs are bounded lowercase opaque tokens compatible with canonical IDs
such as `owner_1` and `node_event_1`; action, provider, and error values are bounded lowercase
category codes; actor and outcome are closed enums; and the timestamp is an offset-aware ISO datetime. There is no
free-form content or payload field. `SafeAuditEventValidationError` uses one constant message.

## `validateSafeAuditEvent`

**Signature:** `(event: unknown) => SafeAuditEvent`

Requires a direct plain or null prototype, inspects every own property descriptor, and rejects symbols, unknown keys,
non-enumerable properties, and accessors before reading any value. It then uses `SafeAuditEventSchema.safeParse`.
Detailed Zod issues are deliberately discarded because they may retain rejected input. Unit tests cover compile-time
sensitive-key rejection, runtime protected keys, exotic properties, nested payloads, controlled values, and serialized
sentinel absence.
