# `src/data/repositories/graph-repository.ts`

This repository saves and reads Vision graph records. Each upsert uses one atomic PostgreSQL statement, so its
answer comes from the row the database actually kept rather than an earlier read.

## `upsertNode`

Makes the requested node version current when it is newer. It returns `applied` for a successful write or safe
retry, and `no_newer_version` when the database already has a later version. It never changes an existing owner or
stable Vision ID. Identity collisions become a safe `GraphIdentityConflictError` without private database details.

## `upsertEvent`

Makes planning-safe event facts current only when the existing provider event has the same owner and stable Vision
ID. Provider version tokens must sort in change order, so an equal retry is safe and an older token cannot overwrite
a newer event. Its matching event node must already exist for that owner.

## `classifyAtomicUpsertResult`

Turns the row returned by the atomic statement into `applied`, `no_newer_version`, or a safe identity-conflict
error. It does not read the database.

## `translateUniqueViolation`

Changes PostgreSQL's unique-conflict code into a privacy-safe graph identity error without copying the raw database
message.

## `replaceEdges`

Replaces one node's graph links together.

## `getEventByProviderIdentity`

Finds one event by its complete provider identity without loading encrypted event details.
