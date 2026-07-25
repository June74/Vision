# `src/integrations/openai/category-schema.ts`

`OpenAiCategoryOutputSchema` accepts only the closed category suggestion fields. OpenAI cannot supply trusted model, request, or policy audit metadata; Vision adds those after validation.

## `safeParseOpenAiCategoryOutput`

Safely checks untrusted model data and returns a validation failure instead of letting getter or proxy errors escape.
