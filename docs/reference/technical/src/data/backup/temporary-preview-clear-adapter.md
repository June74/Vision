# `src/data/backup/temporary-preview-clear-adapter.ts`

Implements the destructive half of the fenced retry as one retained
`Pool({ max: 1 })` serializable transaction. Every failure is reduced to a fixed error, rollback is attempted, and
client release plus pool closure run on every path.

## `createTemporaryPreviewClearAdapter`

Parses only the private restore connection binding, creates the max-one Neon pool, and fixes the target policy to
preview and disposable.

## `connect`

Obtains the single retained Neon session used for the complete transaction.

## `query`

Adapts parameterized driver statements to the narrow client port.

## `release`

Returns the retained client without exposing driver state.

## `end`

Closes the production pool even when connect, rollback, release, or commit fails.

## `createPostgresTemporaryPreviewClearAdapter`

Validates the expected identity once, then exposes a one-shot clear operation over an injected closable pool.

## `clear`

Begins serializable isolation; requires `current_user=vision_app`; locks one exact attestation row; locks all
`BACKUP_TABLES` in canonical order; rereads unchanged attestation; requires all 29 prepared counts and the exact
29/51/13/0 aggregate; deletes in reverse dependency order; recounts every table as zero; rereads unchanged
attestation; and commits. Any statement, postcondition, commit, or cleanup failure returns only the closed error.

## `requireRestoreRole`

Accepts exactly one `vision_app` result before table access.

## `readAttestation`

Requires exactly one row matching preview, the provider-selected target, disposable state, schema version 9, the
migration checksum, and a bounded revision. The first call uses `FOR UPDATE`.

## `requireSameAttestation`

Compares every validated attestation field to the original locked row.

## `readRowCounts`

Projects one count alias per canonical table and rejects missing, negative, fractional, or unsafe values.

## `requireExactPreparedCounts`

Requires a complete 29-key prepared manifest and value equality for every table.

## `requireExpectedAggregate`

Computes the independently approved 51 total rows, 13 non-empty tables, and zero events gate.

## `requireAllZero`

Rejects commit unless every locked authoritative count is zero.

## `validateIdentity`

Requires the fixed preview/disposable policy and a bounded opaque target value.

## `quotedIdentifier`

Admits only compile-time lowercase schema identifiers before quoting.

## `publicTable`

Builds the canonical `"public"."table"` form used by locks, counts, and deletes.
