# `src/domain/operations/usage-warnings.ts`

This pure policy turns trusted database and R2 totals into two actionable
warning booleans. It has no provider, database, logger, or browser access.

## `calculateUsageWarnings`

Checks that every measurement is a non-negative safe integer and every
threshold is a positive safe integer. The database warning begins at its byte
threshold. The R2 warning begins when either its byte threshold or object-count
threshold is reached.

## `isNonnegativeSafeInteger`

Checks whether a measured count or byte total is safe for integer comparison.

## `isPositiveSafeInteger`

Checks whether a configured warning threshold is a usable positive integer.
