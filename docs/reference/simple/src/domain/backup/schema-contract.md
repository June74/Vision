# `src/domain/backup/schema-contract.ts`

Defines the exact migration-9 database shape that every exported or restored backup row must satisfy.

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

Checks one value against its declared database type and nullability.

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

Checks a number or canonical decimal string against a PostgreSQL integer range.

## `isDatabaseTimestamp`

Checks a real date or PostgreSQL timestamp carrying an explicit time-zone offset.

## `isJsonValue`

Accepts only data that PostgreSQL JSONB can represent.

## `integer`

Reads an integer after its database representation has been validated.

## `text`

Reads text after its database representation has been validated.

## `timestamp`

Converts a validated timestamp to milliseconds for comparisons.

## `optionalHash`

Accepts null or one canonical SHA-256 base64url digest.
