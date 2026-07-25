# `src/integrations/openai/model-router.ts`

This module is a closed deterministic router. The routine task union excludes arbitrary model IDs and compile-time overloads preserve the Luna-only category route. The only Terra branch requires `kind: "complex_planning"` plus explicit `complexityEligible` and `budgetEligible` facts.

## `routeModel`

Maps every routine Phase B task to `gpt-5.6-luna`. The conjunction of both future complex-planning gates maps to `gpt-5.6-terra`; all other inputs remain on Luna. There is no flagship or configurable fallback escape.
