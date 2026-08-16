# Calendar-write repository

`DrizzleCalendarWriteRepository` implements both the approval store and the
`CalendarWriteLedger` port. Approval content is serialized, encrypted through
the existing protected-fields/key-provider boundary, and stored as `bytea`.
The encrypted context binds owner ID, operation ID, and controlled
`proposal_domain`. Execution rows store only owner/provider/calendar identity,
status, paired provider event ID/version, and timestamps.

## `createApproval`

Requires a proposed canonical one-off value and `expiresAt > requestedAt`.
Inserts with a conflict fence and requires the returned operation ID to match.

## `findApproval`

Uses `owner_id AND operation_id` and returns no envelope bytes.

## `loadProposal`

Decrypts only after the owner-scoped row is decoded, then rehydrates through
the strict domain constructor and cross-checks operation, owner, calendar,
domain, and proposed status.

## `confirmApproval`

Runs an owner/status/expiry conditional update. A loser reloads authoritative
status and returns `already_confirmed`, `expired`, or `missing`; it cannot
authorize a second claim.

## `invalidateApproval`

Conditionally invalidates proposed or confirmed rows in the same owner scope.

## `find`

Reads the ledger with aliased event identity/version fields and rejects a row
that decodes outside the requested owner and operation scope.

## `claim`

Uses `INSERT ... ON CONFLICT DO NOTHING` as the only durable create fence.
`claimed` is returned only to the insert winner.

## `markPending`

Updates only an existing writing, verified, or pending row; it never inserts a
missing row during uncertain reconciliation.

## `markVerified`

Requires non-empty calendar/event identity and version and transitions only
writing or pending rows.

## `markFailed`

Transitions only a writing row to failed.

## `markUndone`

Transitions only verified to undone, preserving the paired identity evidence.

## `readApprovalRow`

Applies owner scope in SQL, bounds to one row, and validates returned identity.

## `toApprovalRecord`

Projects a decoded row while intentionally omitting encrypted proposal bytes.

## `decodeApprovalRow`

Validates provider, domain, status, bounded identities, expiry ordering, and
envelope byte limits.

## `decodeLedgerRecord`

Rejects unknown status, invalid timestamps, unpaired event identity/version,
and terminal rows without both provider fields.

## `assertProposalForApproval`

Requires proposed status, bounded owner/operation/calendar values, zero
attendees, one-off recurrence, and no notifications.

## `assertOwnerAndOperation`

Prevents empty or control-bearing values from entering any owner predicate.

## `assertProviderIdentity`

Bounds provider IDs, event IDs, and provider versions before SQL parameters.

## `isBoundedIdentity`

Provides a no-coercion bounded scalar check.

## `readBoundedText`

Fails closed rather than converting numbers, objects, or invalid text.

## `readProvider`

Enforces the allowlisted `google` provider discriminator.

## `readProposalDomain`

Selects the existing per-owner/per-domain data-key partition and rejects all
other values.

## `readApprovalStatus`

Enforces `proposed | confirmed | invalidated`.

## `readExecutionStatus`

Enforces `writing | verification_pending | verified | failed | undone`.

## `serializeProposal`

Caps canonical JSON at the protected proposal limit before encryption.

## `encodeEnvelope`

Serializes and bounds the cipher envelope before binding it as `bytea`.

## `parseEnvelope`

Bounds and parses database ciphertext through the existing envelope contract.

## `readDatabaseBytes`

Accepts native `Uint8Array` and canonical `\\x...` PostgreSQL bytea text; no
generic string-to-byte coercion is allowed.

## `readDatabaseDate`

Uses intrinsic Date access and requires an explicit timezone offset when a row
arrives as text.

## `assertDate`

Rejects invalid Date instances using the intrinsic Date prototype.

## `persistenceFailure`

Creates one constant public persistence error without row or SQL detail.

## `normalizePersistenceError`

Preserves only the known safe error and collapses every other failure.
