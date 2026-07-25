# `src/integrations/openai/openai-provider.ts`

This adapter has no global credential lookup, persistence, Google tool, or event-write capability. Callers inject `fetch`, a credential-free AI Gateway base URL, provider key, and finite request bounds. Category routing is statically Luna-only.

Requests use `store: false`, strict `text.format` JSON Schema, and bounded output tokens. Tool, tool-choice, action, and parallel-tool fields are absent. Developer instructions label every event fact as untrusted data. The response body remains under one abort deadline and declared plus streamed byte limits.

Only validated proposal fields, safe model/request IDs, policy version, evidence IDs, and numeric token counters survive parsing. Raw model text, refusals, reasoning, output items, HTTP error bodies, and caught exceptions are never returned.

## `isPlainRecord`

Accepts only object or null-prototype records and catches hostile prototype traps.

## `hasExactKeys`

Enforces closed object shapes at the network boundary, including rejection of callers that bypass the context builder with extra secret-bearing fields.

## `copyBoundedJson`

Copies finite JSON within depth and collection limits. It rejects accessors, symbols, cycles, custom prototypes, dangerous property names, and proxy traps.

## `serializeSafeRequest`

Cross-checks subject ID, policy version, and ordered evidence IDs against the context packet. It validates exact schedule, title, source, and evidence shapes before applying the 16 KiB context bound.

## `readBoundedJson`

Requires `application/json`, validates `Content-Length`, reads incrementally, cancels on overflow, and uses fatal UTF-8 decoding before JSON parsing.

## `extractOutput`

Traverses official message output items while ignoring non-message diagnostic items. It accepts exactly one output text, prefers a refusal marker, and rejects unknown or multiple message content items.

## `mapUsage`

Maps input, cached input, output, reasoning output, and total token counters into immutable cost inputs.

## `buildOutputSchema`

Converts the accepted Task 1 Zod output contract to strict JSON Schema and removes the meta-schema declaration.

## `failure`

Builds a discriminated safe result with only a stable code and validated metadata.

## `proposeCategory`

Returns a `CategoryProposal` on success; failure becomes `OpenAiProviderError` containing only its classification code.

## `proposeCategoryResult`

Validates before dispatch, posts through the injected gateway, keeps timeout active through streaming, validates envelope and usage, recognizes refusal, parses JSON, revalidates through Task 1, requires every returned evidence ID to have been supplied, and attaches trusted audit metadata.
