# `src/data/repositories/graph-repository.ts`

The repository translates pure domain types at the database boundary. It uses Neon HTTP statements and an atomic non-interactive transaction for edge replacement.

## `upsertNode`

Writes the canonical envelope only when its supplied version is newer.

## `upsertEvent`

Upserts explicit provider event identity and planning-safe timing fields.

## `replaceEdges`

Deletes existing source-owner edges then inserts replacements in one transaction.

## `getEventByProviderIdentity`

Looks up the complete owner-scoped provider identity and returns its planning-safe event.
