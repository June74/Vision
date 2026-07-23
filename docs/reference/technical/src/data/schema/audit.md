# `src/data/schema/audit.ts`

Audit rows exclude protected content; the operation ledger protects any retained provider response with binary ciphertext.

## `auditEvents`

Defines opaque actor, action, outcome, provider, error, and time fields.

## `operationLedger`

Defines idempotent provider operation state using owner/provider/operation uniqueness.
