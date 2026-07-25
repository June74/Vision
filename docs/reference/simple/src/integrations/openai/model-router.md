# `src/integrations/openai/model-router.ts`

This module keeps routine Vision AI work on Luna. Terra is available only for a future complex-planning task after deterministic complexity and budget checks both pass.

## `routeModel`

Returns `gpt-5.6-luna` for categorization, wording, routine extraction, summaries, and ineligible planning. Returns `gpt-5.6-terra` only for eligible complex planning.
