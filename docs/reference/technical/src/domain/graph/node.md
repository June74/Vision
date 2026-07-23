# `src/domain/graph/node.ts`

This module owns the provider-independent common registry contract. `NodeEnvelopeSchema` is a strict discriminated union over every Version 1 object type, with owner, mandatory complete identity, category state, privacy, provenance, lifecycle, validity interval, and positive monotonic version.

## `NodeIdentitySchema`

The identity discriminates `provider`, `first_party`, and `system` records. Every variant requires a non-empty stable ID; first-party and system variants explicitly identify `vision`, while a provider identity retains its source system. This avoids an absent or partial identity pair on any canonical node.

## `NodeEnvelopeSchema`

The schema uses `nodeType` as its discriminator. Its refinement requires the shared valid domain/state combination and requires `modelConfidence` exactly when `domainState` is inferred, preventing contradictory state or unsupported confidence claims. Covered by `tests/unit/domain/graph.test.ts`.
