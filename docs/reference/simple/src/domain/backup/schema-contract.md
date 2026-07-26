# `src/domain/backup/schema-contract.ts`

Defines the exact migration-9 database shape and PostgreSQL-safe value forms that every exported or restored backup
row must satisfy.

## `defineColumns`

Turns short column declarations into immutable type and nullability rules.

## `defineTable`

Builds one immutable table rule with keys, alternate identities, and relationships.

## `validateBackupRow`

Rejects unknown fields, invalid database values, nullability mistakes, and failed migration checks.

## `validateBackupTableIdentities`

Rejects duplicate primary keys and every duplicate full or conditional alternate identity.

## `validateBackupReferences`

Rejects rows whose required relationship target is missing.

## `validateColumnValue`

Checks one value against its declared database type and nullability, including PostgreSQL's lossless text and range
rules.

## `validateTableChecks`

Applies the migration's table-specific business and consistency rules.

## `nonempty`

Requires named text columns to contain text.

## `oneOf`

Requires a text value to belong to a closed set.

## `optionalOneOf`

Allows null or a member of a closed text set.

## `positive`

Requires an integer to be greater than zero.

## `nonnegative`

Requires an integer to be zero or greater.

## `optionalPositive`

Allows null or a positive integer.

## `optionalNonnegative`

Allows null or a nonnegative integer.

## `atLeast`

Requires one time to be the same as or later than another.

## `after`

Requires one time to be later than another.

## `optionalAtLeast`

Allows a missing time or requires it not to precede another time.

## `requireCheck`

Turns a failed migration rule into a safe backup validation error.

## `budgetMonth`

Requires the `YYYY-MM` form used for monthly AI budget rows.

## `validateIdentity`

Finds duplicate values for one primary or alternate identity.

## `matchesIdentityConditions`

Decides whether a row belongs to a conditional unique identity.

## `referenceKey`

Builds an exact typed key for a database relationship.

## `requirePlainRow`

Rejects rows containing prototypes, getters, symbols, or hidden fields.

## `isDatabaseInteger`

Checks an exact integer number or decimal string against a PostgreSQL range without accepting `-0`, leading zeros,
whitespace, exponents, decimal points, or coercion.

## `isDatabaseTimestamp`

Checks a real date or a strict Gregorian timestamp with a supported explicit PostgreSQL time-zone offset. Impossible
dates, normalized 24-hour/leap-second forms, year zero, and offsets beyond 15:59 are rejected.

## `parseDatabaseTimestamp`

Converts a valid date, fraction, and numeric offset into one exact microsecond count without losing sub-millisecond
ordering.

## `isPostgresText`

Rejects NUL and lone UTF-16 surrogate code units while allowing correctly paired astral Unicode characters.

## `isJsonValue`

Accepts only data that PostgreSQL JSONB can represent losslessly, rejecting NUL or lone surrogates in every nested
string and object key.

## `integer`

Reads an integer after its database representation has been validated.

## `text`

Reads text after its database representation has been validated.

## `timestamp`

Converts a validated timestamp to exact epoch microseconds for migration-check comparisons.

## `optionalHash`

Accepts null or one canonical SHA-256 base64url digest.
