# `src/integrations/openai/category-schema.ts`

## `OpenAiCategoryOutputSchema`

This schema is the structural untrusted proposal object and has no audit property. The adapter, not model output, owns model ID, provider request ID, and policy version. Generated JSON Schema therefore has exactly `domain`, `confidence`, `evidenceIds`, `ambiguous`, and `rationaleCode` as required properties with `additionalProperties: false`. Runtime refinement also rejects contradictory domain/rationale, ambiguity, and evidence semantics.

## `safeParseOpenAiCategoryOutput`

**Signature:** `safeParseOpenAiCategoryOutput(input: unknown): SafeParseResult<OpenAiCategoryOutput>`

The public runtime parser composes trap-safe JSON normalization with `OpenAiCategoryOutputSchema`. Accessors, hostile prototypes, proxy inspection traps, prototype-pollution keys, and ordinary schema failures return `success: false` instead of throwing.
