# `src/domain/calendar-write`

This folder owns the provider-neutral Phase C write contract and execution
ports. It validates immutable proposals, produces exact before/after previews,
enforces the approval transition graph, and verifies provider state through
injected interfaces. It contains no Worker, provider, database, crypto, or
browser boundary; composition layers must consume these values rather than
reimplement their policy. `event-mutation.ts` is the strict one-off mutation
contract; `mutation-execution.ts` is its verified provider execution boundary.
Recurrence scope remains a later explicitly accepted extension.
