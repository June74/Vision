# `src/integrations/openai/openai-provider.ts`

This module sends one minimum category packet through the configured Cloudflare AI Gateway. It requests strict JSON, provides no tools, bounds time and response size, and returns only a proposal or safe error category.

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

Finds exactly one official output-text item or a refusal.

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
