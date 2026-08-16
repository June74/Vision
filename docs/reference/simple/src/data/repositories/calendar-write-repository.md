# Calendar-write repository

This repository keeps the proposed event encrypted until confirmation and
keeps the provider execution ledger separate. Every read and state change is
scoped by the authenticated owner and opaque operation ID.

## `createApproval`

Encrypts the immutable proposal and inserts one proposed approval.
`proposal_domain` is only the controlled key partition.

## `findApproval`

Reads approval status and safe target facts for one owner.

## `loadProposal`

Decrypts and strictly rechecks the stored proposal after owner lookup.

## `confirmApproval`

Performs the unexpired proposed-to-confirmed compare-and-set.

## `invalidateApproval`

Closes a stale or unusable approval without exposing its content.

## `find`

Reads the owner-scoped execution ledger row.

## `claim`

Wins the exactly-one provider-create fence or reports that another caller won.

## `markPending`

Keeps an uncertain create or undo in verification-pending state.

## `markVerified`

Stores provider event identity and version only after read-back verification.

## `markFailed`

Stores a definite failure without storing provider details.

## `markUndone`

Closes an operation only after verified provider absence.

## `readApprovalRow`

Loads a single owner-scoped encrypted approval row.

## `toApprovalRecord`

Returns safe approval metadata without the envelope.

## `decodeApprovalRow`

Checks every approval identity, status, date, and ciphertext field.

## `decodeLedgerRecord`

Checks status, timestamps, and paired provider identity/version.

## `assertProposalForApproval`

Rejects proposals that are not valid one-off approvals.

## `assertOwnerAndOperation`

Checks both query-scope identities before SQL.

## `assertProviderIdentity`

Checks a bounded opaque provider identity.

## `isBoundedIdentity`

Recognizes non-empty text without control characters.

## `readBoundedText`

Decodes one bounded row value.

## `readProvider`

Accepts only the current `google` provider code.

## `readProposalDomain`

Accepts only school, work, or personal key partitions.

## `readApprovalStatus`

Accepts the three approval statuses.

## `readExecutionStatus`

Accepts the five execution statuses.

## `serializeProposal`

Bounds canonical proposal JSON before encryption.

## `encodeEnvelope`

Bounds and encodes the protected envelope as database bytes.

## `parseEnvelope`

Parses bounded ciphertext bytes.

## `readDatabaseBytes`

Reads native bytes or canonical PostgreSQL bytea text.

## `readDatabaseDate`

Reads a native Date or an explicit-offset timestamp.

## `assertDate`

Rejects invalid dates before a write.

## `persistenceFailure`

Creates the constant `Calendar write persistence failed.` error.

## `normalizePersistenceError`

Collapses SQL, crypto, and decoder failures into that safe error.
