# `src/domain/categorization/category.ts`

This module provides the pure, closed category contract for canonical nodes. `DomainResolutionInputSchema` is strict so a model suggestion cannot smuggle privacy or authority-bearing fields into the resolver.

## `DomainSchema`

The closed stored values are `school`, `work`, `personal`, and `unresolved`.

## `DomainStateSchema`

The state records confidence provenance independently from the category value: confirmed, inferred, or unresolved.

## `resolveDomain`

**Signature:** `resolveDomain(input: DomainResolutionInput): DomainDecision`

The resolver validates its strict input, then checks explicit category, confirmed source category, and inference in that order. Inference preserves its 0-to-1 confidence and yields `inferred`; absence of all evidence yields the exact unresolved decision. It has no privacy or sharing input, output, side effect, or external dependency. Covered by `tests/unit/domain/category.test.ts`.
