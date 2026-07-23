# `src/data/schema`

These Drizzle definitions declare every supported reviewed PostgreSQL key, owner-scoped foreign key, and named check: a common node envelope, typed events, governed edges, privacy-safe audit facts, and explicit synchronization/recovery state. The reviewed SQL migration remains canonical; `tests/contract/data/drizzle-structure.contract.test.ts` independently checks Drizzle table metadata so an omitted constraint fails review.
