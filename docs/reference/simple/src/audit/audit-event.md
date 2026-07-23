# `src/audit/audit-event.ts`

This file defines the only information Vision may keep in an audit record: bounded lowercase opaque IDs, a controlled action and actor,
the time, outcome, provider, and safe error category. Extra, hidden, inherited, accessor, symbol, or nested fields are
rejected without exposing their values.

## `validateSafeAuditEvent`

Checks that an audit event is a plain object with only the approved fields and values. It returns a clean copy or
throws the same safe error for every invalid input.
