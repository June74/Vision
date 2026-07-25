# `src/data/repositories/diagnostic-repository.ts`

The factory fixes one owner in closure so operations cannot supply or switch owners. Operational SQL returns only counts, states, and timestamps. Event SQL selects encrypted titles inside that owner scope and decrypts after row validation; descriptions, attendees, locations, meeting links, provider identities, tokens, and keys never enter the API shape.

## `readFoundationFacts`

Uses scalar owner-scoped PostgreSQL aggregates to read the newest Google Calendar checkpoint, latest successful Google sync, oldest open Google job, maximum open retry count, failed-job count, active Google channel expiry, OAuth-token presence, and settled-plus-reserved current Chicago-month cents. Explicit provider predicates prevent unrelated future integrations from changing Google health. Usage-warning booleans are injected from the release-monitoring boundary.

## `listEvents`

Selects at most 200 active owner events ordered by start and opaque node ID. It includes only the title envelope required for display and delegates exact validation/decryption to `decodeEvent`.

## `correctCategory`

One data-modifying Common Table Expression updates only `nodes` plus `node_category_assignments`. It sets `domain_state = confirmed`, `provenance = user`, clears `model_confidence`, advances the node version, and upserts the matching explicit assignment. It never updates `events` or calls Google.

## `decodeEvent`

Validates identifiers, status, domain, state, provenance, timestamps, and key version before decryption. The envelope-embedded key version must equal the row key version. Only the `title` field is decrypted under exact owner/node/domain authenticated metadata.

## `createDiagnosticRepository`

**Signature:** `createDiagnosticRepository(database, keyProvider, ownerId, usageWarnings): DiagnosticRepositoryPort`

Validates the owner and warnings once, freezes the warning snapshot, and returns the owner-scoped implementation.

## `decodeEnum`

Rejects database values outside the caller-provided immutable allowlist.

## `decodeText`

Requires non-empty text within an explicit maximum.

## `decodeDate`

Accepts finite `Date` instances or timezone-bearing PostgreSQL text, including Neon’s compact `+00` offset.

## `decodeNullableDate`

Maps database null/undefined to null and otherwise delegates to `decodeDate`.

## `decodeNonnegativeInteger`

Safely decodes numeric, bigint, or canonical decimal aggregate values.

## `decodePositiveInteger`

Adds a positive constraint for node versions and protected key versions.

## `decodeBytea`

Copies bounded `Uint8Array` values or decodes canonical lowercase PostgreSQL hex. It never serializes ciphertext into an API response.

## `assertDate`

Requires a finite `Date` at repository entry.

## `validateEventId`

Requires a bounded opaque identifier before parameterized correction SQL.

## Covering tests

`tests/integration/data/diagnostic-repository.test.ts` uses all Phase B migrations in PGlite to verify owner isolation, real title decryption, operational aggregates, inference invalidation, and byte-identical provider event persistence.
