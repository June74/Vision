# `src/data/repositories/ai-usage-repository.ts`

The repository uses data-modifying PostgreSQL common table expressions plus an owner advisory transaction lock. Admission cleans expired leases, updates monthly totals, checks projected thresholds, enforces the partial unique in-flight index, creates the reservation, and appends ledger events atomically. It never accepts prompt or response fields.

## `reserve`

Creates the month row, serializes owner admission, releases stale pre-dispatch work, settles stale dispatched work at estimate, checks active work and projected cents, then appends the reserved transition. Optional and complex requests cannot reserve across their 900- and 800-cent boundaries.

## `markDispatched`

Atomically moves only an unexpired `reserved` row to `dispatched`, replaces its context-loading expiry with the supplied bounded provider-call expiry, and appends an immutable dispatch event. The exact expiry boundary is rejected.

## `settle`

Moves `dispatched` to actual settlement, or reconciles a later actual cost over `settled_estimate`. Monthly deltas avoid double counting. An exact retry is accepted; conflicting cost or metadata fails.

## `release`

Moves only undispatched `reserved` work to `released`, decrements reserved cents, and appends the release event.

## `readStatus`

Reads only the status needed to classify idempotent dispatch and release retries.

## `readSettlement`

Reads the safe numeric/identifier settlement tuple so a repeated write must match exactly.

## `createAiUsageRepository`

Constructs the implementation over the typed Vision database.

## `assertIdentifier`

Requires bounded opaque identifiers and rejects free-form content.

## `assertRequestClass`

Rejects runtime values outside routine, optional, and complex.

## `assertPositiveCents`

Requires a positive safe integer estimate.

## `assertNonNegativeCents`

Requires a non-negative safe integer actual amount.

## `assertDate`

Uses trusted `Date` intrinsics and rejects invalid timestamps.

## `assertSettlementMetadata`

Rejects extra keys and bounds provider identifiers and token counters.

## `readText`

Decodes a required non-empty PostgreSQL text field.

## `readNonNegativeCents`

Decodes number or canonical decimal integer representations.

## `readBoolean`

Rejects non-boolean transition results.

## `readNullableText`

Decodes nullable provider metadata.

## `readNullableInteger`

Decodes nullable usage counters.
