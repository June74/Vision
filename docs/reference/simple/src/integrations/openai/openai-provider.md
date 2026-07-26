# `src/integrations/openai/openai-provider.ts`

This module sends one minimum category packet through the pinned Cloudflare AI Gateway OpenAI endpoint. It disables gateway payload logging and caching, rejects redirects, requests strict JSON, provides no tools, bounds time and response size, and returns only a proposal or safe error category.

## `MAX_OPENAI_PROVIDER_TIMEOUT_MS`

Publishes the provider's accepted 30-second timeout ceiling for dispatch-lease validation.

## `isApprovedLunaResponseModel`

Accepts only the Luna alias or a canonical, calendar-valid Luna snapshot ID.

## `isPlainRecord`

Recognizes plain data objects.

## `hasExactKeys`

Checks that a record contains only allowed fields.

## `copyBoundedJson`

Copies small JSON data without running getters or custom serialization.

## `serializeSafeRequest`

Validates the exact category packet and serializes only permitted context.

## `readBoundedJson`

Reads a JSON response with content-type and byte limits.

## `extractOutput`

Reads exactly one validated completed assistant output-text item or refusal. One safe reasoning summary item may precede the message and is discarded.

## `mapUsage`

Keeps only token counters needed for later cost accounting.

## `buildOutputSchema`

Creates the strict category JSON Schema sent to OpenAI.

## `failure`

Creates a typed error result without raw provider data.

## `proposeCategory`

Implements the provider-neutral port and throws a safe classified error when no proposal is available.

## `proposeCategoryResult`

Returns a validated proposal or a typed refusal, invalid-input, invalid-schema, timeout, or provider-error result.
