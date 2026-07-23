# `src/data/repositories/graph-repository.ts`

This repository saves and reads Vision graph records.

## `upsertNode`

Saves a newer node version using its owner, provider, and provider ID. A different owner cannot update it.

## `upsertEvent`

Saves planning-safe event facts only when an existing provider event has the same owner. Its matching event node must already exist for that owner.

## `replaceEdges`

Replaces one node's graph links together.

## `getEventByProviderIdentity`

Finds one event by its complete provider identity without loading encrypted event details.
