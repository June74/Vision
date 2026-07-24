# Calendar repository

Captures owner and verified subject. Parameterized PostgreSQL compare-and-swap statements linearize setup versions. A data-modifying CTE advances confirmation, inserts the operation ledger, and inserts normalized snapshot IDs before returning.

## `getOrCreateAuthenticated`
Uses insert-on-conflict with exact owner-subject winner validation.
## `discover`
Lists first, then one statement inserts/CASes the prior version directly to `awaiting_choice` or `awaiting_confirmation`, clears candidates, and inserts only the winner's evidence. A concurrent loser reloads the authoritative snapshot.
## `selectExisting`
Requires a candidate row and fresh evidence in the connection CTE.
## `beginCreation`
Only the CAS winner inserts ledger/snapshot; a partial index permits one unresolved operation.
## `takeOverStaleCreation`
Locks the exact owner/key ledger and matching setup version. A request still inside the two-minute route lease remains `in_progress`; an expired operation advances once to reconciliation-only `retryable` and never authorizes another insert.
## `findCreationOperation`
Scopes by owner/provider/kind/key and bounds joined rows.
## `completeCreation`
Atomically connects evidence, records result ID, completes ledger, and increments version.
## `markCreationUncertain`
Uses the ledger's stored confirmation version to move only `in_progress` to `retryable`, then only `retryable` to `action_required`; it cannot authorize insert.
## `markCreationDefiniteFailure`
Atomically binds the exact key and stored setup version, supersedes valid `in_progress`, `retryable`, or `action_required` ledger states, preserves manual-action ambiguity, and releases the partial unique claim.
## `readSnapshot`
Uses bounded owner-subject reads.
## `getSnapshot`
Delegates inside immutable scope.
## `requireSnapshot`
Collapses missing post-write state.
## `toCandidateParameter`
Serializes only ID, timezone, ETag, and verification time.
## `validateEvidenceSet`
Caps at 100 and rejects duplicate IDs.
## `validateEvidence`
Requires `Vision`, `owner`, exact subject, bounded fields, and valid time.
## `decodeCreationOperation`
Strictly decodes status/version/time/IDs.
## `decodeSetupSnapshot`
Strictly decodes state and revalidates evidence.
## `decodeConnection`
Allows only `existing` or `created`.
## `assertUuid`
Requires canonical UUID variant/version shape.
## `assertVersionAndDate`
Rejects unsafe or nonpositive versions.
## `assertDate`
Uses intrinsic Date access.
## `isValidDate`
Rejects invalid Dates.
## `isBoundedText`
Rejects empty or oversized scalars.
## `readPositiveInteger`
Allows number or canonical decimal text.
## `readText`
Never coerces database rows.
## `readBoolean`
Never applies truthy coercion.
## `readDate`
Allows Date or explicit offset strings.
## `staleVersion`
Returns `STALE_SETUP_VERSION`.
## `invalidEvidence`
Returns `INVALID_CALENDAR_EVIDENCE`.
## `persistenceFailure`
Returns `CALENDAR_PERSISTENCE_FAILED` without cause.
