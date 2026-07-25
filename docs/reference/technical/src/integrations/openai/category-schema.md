# `src/integrations/openai/category-schema.ts`

## `OpenAiCategoryOutputSchema`

This schema composes the domain proposal boundary and additionally rejects the optional trusted audit object. The adapter, not model output, owns model ID, provider request ID, and policy version. Strict validation rejects unknown domains, non-finite confidence, missing or hostile evidence identifiers, free-form reasoning, and extra action, tool, privacy, sharing, deletion, or permission fields.
