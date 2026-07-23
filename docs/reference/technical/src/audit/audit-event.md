# `src/audit/audit-event.ts`

`SafeAuditEventSchema` is a strict Zod object. IDs are bounded lowercase opaque tokens compatible with canonical IDs
such as `owner_1` and `node_event_1`; action, provider, and error values are bounded lowercase
category codes; actor and outcome are closed enums; and the timestamp is an offset-aware ISO datetime. There is no
free-form content or payload field. `SafeAuditEventValidationError` uses one constant message.

## `validateSafeAuditEvent`

**Signature:** `(event: unknown) => SafeAuditEvent`

Requires a direct plain or null prototype, rejects enumerable `Object.prototype` descriptors without invoking them,
then inspects every own descriptor and copies only allowlisted enumerable data properties into a fresh null-prototype
record. Zod parses only that closed copy.
Detailed Zod issues are deliberately discarded because they may retain rejected input. Unit tests cover compile-time
sensitive-key rejection, runtime protected keys, exotic properties, nested payloads, controlled values, and serialized
sentinel absence.
