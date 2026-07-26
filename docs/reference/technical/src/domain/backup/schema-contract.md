# `src/domain/backup/schema-contract.ts`

This is the sole reviewed migration-9 source for the backup table order, columns, PostgreSQL types, nullability,
primary keys, full and partial unique indexes, foreign keys, check constraints, and PostgreSQL-safe value admission.
Export validates the captured snapshot before hashing; import validates decoded rows before any target write. The
pinned SHA-256 of migrations 0001 through 0009 lets the database-backed contract test detect structural drift, while
PGlite differential probes keep runtime value admission aligned with PostgreSQL.

## `defineColumns`

Expands `kind` and nullable `kind?` declarations into frozen `BackupColumnContract` objects.

## `defineTable`

Freezes one table's column map, composite primary key, alternate identities, and references.

## `validateBackupRow`

Requires a plain closed row, exact column set, admitted PostgreSQL driver representations, declared nullability, and
all table-specific migration checks.

## `validateBackupTableIdentities`

Runs the primary identity and every full or partial unique-index identity with PostgreSQL-style nullable uniqueness.

## `validateBackupReferences`

Builds typed target-key sets and verifies every required or optional migration foreign key over the complete snapshot.

## `validateColumnValue`

Admits exact bounded SQL integer forms, booleans, NUL-free strings, strict explicit-offset Gregorian timestamps,
`Uint8Array` or canonical bytea hex, and recursively plain NUL-free JSONB values.

## `validateTableChecks`

Mirrors the check constraints from migrations 0001 through 0009 after structural and SQL-type validation.

## `nonempty`

Evaluates the repeated non-empty text predicate used by migration checks.

## `oneOf`

Evaluates a closed text enum predicate.

## `optionalOneOf`

Evaluates a nullable closed text enum predicate.

## `positive`

Evaluates a strictly positive integer predicate.

## `nonnegative`

Evaluates a nonnegative integer predicate.

## `optionalPositive`

Evaluates a nullable strictly positive integer predicate.

## `optionalNonnegative`

Evaluates a nullable nonnegative integer predicate.

## `atLeast`

Compares validated timestamps using inclusive epoch ordering.

## `after`

Compares validated timestamps using strict epoch ordering.

## `optionalAtLeast`

Skips null or applies inclusive timestamp ordering.

## `requireCheck`

Collapses a false mirrored predicate to a table-scoped safe validation error.

## `budgetMonth`

Checks the canonical four-digit-year and two-digit-month form.

## `validateIdentity`

Applies optional partial-index conditions, PostgreSQL null semantics, typed composite serialization, and duplicate
detection.

## `matchesIdentityConditions`

Evaluates equality and closed-set predicates for a partial unique index.

## `referenceKey`

Serializes non-null typed composite foreign-key components without string/number collisions.

## `requirePlainRow`

Rejects nonstandard prototypes, symbol keys, accessors, and non-enumerable properties before reading row values.

## `isDatabaseInteger`

Admits non-negative-zero safe integer numbers or decimal strings whose `BigInt` round trip is byte-identical and
within the declared `smallint` or `integer` range. This rejects leading plus signs, negative zero, whitespace,
leading-zero, decimal, exponent, and overflow alternatives before any JavaScript number coercion.

## `isDatabaseTimestamp`

Admits finite `Date` values in years 0001 through 9999 or strict Gregorian timestamp strings with `Z` or PostgreSQL's
numeric offsets through 15:59. Calendar components are validated directly, so `Date.parse` cannot silently normalize
an impossible date, 24:00, or leap-second representation.

## `isJsonValue`

Recursively rejects NUL in string values or object keys, non-finite numbers, dates, byte arrays, non-plain objects,
accessors, symbols, and excessive depth.

## `integer`

Normalizes an already validated numeric driver representation for migration predicates.

## `text`

Reads an already validated text representation for migration predicates.

## `timestamp`

Normalizes an already validated timestamp representation to epoch milliseconds.

## `optionalHash`

Checks null or a canonical 43-character unpadded base64url SHA-256 digest.
