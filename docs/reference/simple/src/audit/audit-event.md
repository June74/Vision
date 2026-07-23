# `src/audit/audit-event.ts`

This file defines the only information Vision may keep in an audit record: bounded lowercase opaque IDs, a controlled action and actor,
the time, outcome, provider, and safe error category. Extra, hidden, inherited, accessor, symbol, or nested fields are
rejected without exposing their values.

## `validateSafeAuditEvent`

Checks descriptors before values, rejects enumerable `Object.prototype` pollution without invoking getters, copies
only own data properties into a fresh null-prototype record, and validates that closed copy.
