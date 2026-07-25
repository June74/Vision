# `src/integrations/openai/budgeted-ai-provider.ts`

This adapter composes the accepted Task 2 result API with durable Task 3 accounting. Rates and worst-case estimates are injected and validated; no provider price is hardcoded. The wrapper reserves before dispatch, writes the dispatch marker before invoking the network adapter, and settles actual metadata or the estimate when outcome cost is unknown.

## `proposeCategory`

Generates an opaque operation identity, uses routine admission, and exposes only a safe typed error on failure.

## `proposeCategoryResult`

Delegates eager requests through the same lazy admission path.

## `proposeCategoryFromFactory`

Reserves projected cost and returns without provider-context construction on budget/concurrency denial. After admission it builds the bounded request, marks dispatch, invokes once, and settles. Provider throws and Gateway failures are conservatively charged. Accounting failure after dispatch returns unavailable while leaving durable state for stale conservative recovery.

## `requestFactory`

Defers request construction and its potentially sensitive context copying until the durable repository admits the reservation.


## `releaseSafely`

Attempts release only after dispatch marking failed, so a possibly dispatched call is never erased.

## `settleSafely`

Contains repository failure and returns a boolean without provider or database details.

## `calculateActualCents`

Uses `BigInt` integer arithmetic and ceiling division over injected cents-per-million-token rates.

## `settlementMetadata`

Whitelists request/model IDs and numeric usage; proposal text, context, prompt, response, and reasoning are absent.

## `unavailable`

Builds the closed admission failure union.

## `isValidPricing`

Requires exactly three positive worst-case estimates below the hard stop and bounded non-negative integer rates.

## `isValidRate`

Bounds integer cents per million tokens.

## `isValidTokenCount`

Bounds integer provider counters before cost arithmetic.

## `isOpaqueIdentifier`

Requires a bounded identifier character set.

## `isValidDate`

Uses trusted `Date` intrinsics to reject invalid clocks.
