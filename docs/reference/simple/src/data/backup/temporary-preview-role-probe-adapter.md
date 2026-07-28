# `src/data/backup/temporary-preview-role-probe-adapter.ts`

Checks whether one disposable preview database connection uses the dedicated
Vision application role without reading application tables or returning the
role value.

## `createTemporaryPreviewRoleProbeAdapter`

Creates one Neon connection pool limited to a single retained client.

## `connect`

Opens the sole retained client used by the read-only probe.

## `query`

Runs only the fixed boolean role predicate.

## `release`

Releases the retained client after the read or a query failure.

## `end`

Closes the pool after every success or failure path.

## `createPostgresTemporaryPreviewRoleProbeAdapter`

Builds the testable adapter over an injected max-one pool.

## `probeRole`

Returns true only for exactly one row containing a literal true result. Every
other row shape returns false; connection, query, release, or close failures
throw one fixed value-free error.
