# `src/data/backup/temporary-preview-clear-adapter.ts`

Clears only the exact attested disposable preview target after the caller owns the one-shot fence.

## `createTemporaryPreviewClearAdapter`

Creates one Neon connection pool limited to a single retained client.

## `connect`

Opens that one retained transaction client.

## `query`

Runs a clear transaction statement without returning private driver details.

## `release`

Releases the retained client after commit or rollback.

## `end`

Closes the pool on every success or failure path.

## `createPostgresTemporaryPreviewClearAdapter`

Builds the testable serializable clear engine.

## `clear`

Requires the `vision_app` role, locks the exact attestation and all 29 tables, matches every prepared count plus the
51-row, 13-non-empty, zero-event aggregate, deletes in reverse order, proves every table empty and the attestation
unchanged, then commits.

## `requireRestoreRole`

Requires the dedicated application database role.

## `readAttestation`

Reads the sole preview/disposable/schema-9 attestation and optionally locks it.

## `requireSameAttestation`

Rejects any protected attestation change before or after deletion.

## `readRowCounts`

Reads safe integer counts for all 29 authoritative tables.

## `requireExactPreparedCounts`

Requires exact equality with the complete prepared manifest.

## `requireExpectedAggregate`

Requires 29 tables, 51 rows, 13 non-empty tables, and zero event rows.

## `requireAllZero`

Requires all 29 post-delete counts to be zero.

## `validateIdentity`

Validates the provider-selected preview identity without echoing it.

## `quotedIdentifier`

Quotes one fixed schema identifier.

## `publicTable`

Qualifies one authoritative table in the public schema.
