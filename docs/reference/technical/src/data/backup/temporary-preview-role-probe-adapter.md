# `src/data/backup/temporary-preview-role-probe-adapter.ts`

Implements the isolated preview role check as one retained
`Pool({ max: 1 })` session. It contains no transaction, table access, mutation,
retry, R2, restore, target-identity, encryption-key, or HTTP capability.

## `createTemporaryPreviewRoleProbeAdapter`

Receives the already validated temporary connection string and constructs the
max-one Neon pool.

## `connect`

Obtains the only retained Neon client used for the complete operation.

## `query`

Adapts the driver to the narrow one-statement client port without retaining
driver output.

## `release`

Returns the retained client on every path after successful connection.

## `end`

Closes the pool even when connection, query, or client release fails.

## `createPostgresTemporaryPreviewRoleProbeAdapter`

Exposes the fixed read-only probe over an injected closable pool.

## `probeRole`

Executes exactly one fixed boolean predicate, requires one row and a literal
boolean, and returns only that boolean. Missing, duplicate, or nonboolean
results fail closed as false. Resource or driver failures throw only
`Temporary preview role probe failed.`
