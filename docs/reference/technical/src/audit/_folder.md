# `src/audit`

The audit boundary is independent of runtime logging and database schema details. `audit-event.ts` owns the exact
compile-time and runtime data contract. `audit-writer.ts` serializes only the validator's normalized result into an
injected append-only sink. Rejected input values never enter an error message or sink call.
