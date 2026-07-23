# `src/domain/graph/node.ts`

This module owns the provider-independent common registry contract. `NodeEnvelopeSchema` is a strict discriminated union over every Version 1 object type, with owner, optional source identity, category state, privacy, provenance, lifecycle, validity interval, and positive monotonic version.

## `NodeEnvelopeSchema`

The schema uses `nodeType` as its discriminator. Its refinement requires `modelConfidence` exactly when `domainState` is inferred, preventing unsupported confidence claims on confirmed or unresolved data. Covered by `tests/unit/domain/graph.test.ts`.
