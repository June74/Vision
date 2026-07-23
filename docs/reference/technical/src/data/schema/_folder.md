# `src/data/schema`

These Drizzle definitions declare every supported reviewed PostgreSQL key, owner-scoped foreign key, and named check: a common node envelope, typed events, governed edges, privacy-safe audit facts, and explicit synchronization/recovery state.

`migrations/0001_phase_b_foundation.sql` remains canonical. `tests/contract/data/phase-b-schema-manifest.ts` is a manual, line-traced translation of its eight `CREATE TABLE` blocks; it is not produced from runtime metadata. It records every ordered column/type/nullability/default, every primary and unique key by exact ordered columns, every named foreign-key endpoint, and every named normalized check expression. Primary and unique names are intentionally excluded because the reviewed SQL leaves those names implicit.

`tests/contract/data/schema-manifest.ts` forms the independent actual side. It reads `getTableConfig`, renders check SQL through `PgDialect`, normalizes only table qualification, identifier quoting, whitespace, and the equivalent `timestamptz` type spelling, then performs a strict deep comparison. The same manifest is also compared with `migrations/generated/meta/0000_snapshot.json`. The retained generated SQL remains reviewer-readable evidence, while the snapshot is the structured generated artifact covered by the automated comparison; a fresh `drizzle-kit generate` must report no schema changes.
