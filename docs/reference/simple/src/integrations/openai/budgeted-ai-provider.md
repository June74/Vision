# `src/integrations/openai/budgeted-ai-provider.ts`

Wraps the OpenAI adapter so every call reserves budget and the private user can have only one AI request in flight.

## `proposeCategory`

Implements the provider-neutral category port through routine budget admission.

## `proposeCategoryResult`

Returns a provider result or a safe budget, concurrency, duplicate, or accounting-unavailable result.

## `proposeCategoryFromFactory`

Reserves budget before building provider context, then dispatches and settles the admitted request.

## `requestFactory`

Builds or asynchronously loads the provider request only after budget admission.

## `releaseSafely`

Releases only a failed pre-dispatch reservation.

## `settleSafely`

Persists cost without leaking database errors.

## `calculateActualCents`

Calculates rounded-up cost from injected rates and safe token counts.

## `settlementMetadata`

Copies only provider IDs, model ID, and token counts.

## `unavailable`

Creates a typed unavailable result.

## `isValidPricing`

Validates the complete injected pricing configuration.

## `isValidRate`

Checks one per-million-token rate.

## `isValidTokenCount`

Checks a provider token counter.

## `isOpaqueIdentifier`

Checks an owner, operation, or reservation ID.

## `isValidDate`

Checks a timestamp.
