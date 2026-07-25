# `src/data/repositories/ai-usage-repository.ts`

This repository reserves, dispatches, settles, and safely releases AI cost records.

## `reserve`

Expires stale work, enforces one active request, and reserves worst-case cents.

## `markDispatched`

Records that a provider call can no longer be safely released.

## `settle`

Replaces reserved cents with actual or conservative cost once.

## `release`

Releases only work that never reached provider dispatch.

## `readStatus`

Reads a reservation status for safe retries.

## `readSettlement`

Checks whether a repeated settlement exactly matches the stored facts.

## `createAiUsageRepository`

Creates the PostgreSQL repository.

## `assertIdentifier`

Checks opaque accounting identifiers.

## `assertRequestClass`

Checks the closed request class.

## `assertPositiveCents`

Checks positive cent values.

## `assertNonNegativeCents`

Checks non-negative cent values.

## `assertDate`

Checks accounting timestamps.

## `assertSettlementMetadata`

Allows only safe provider IDs and numeric usage.

## `readText`

Reads required database text.

## `readNonNegativeCents`

Reads database integers safely.

## `readBoolean`

Reads database booleans.

## `readNullableText`

Reads optional safe text.

## `readNullableInteger`

Reads optional safe integers.
