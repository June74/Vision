# Calendar repository

Stores versioned setup, normalized choices, connection evidence, and one-shot creation records inside one owner/account scope.

## `getOrCreateAuthenticated`
Creates or reads initial state.
## `beginDiscovery`
Starts discovery at the current version.
## `completeDiscovery`
Stores choices and advances state.
## `selectExisting`
Connects one rechecked stable ID.
## `beginCreation`
Atomically stores key and pre-create IDs before Google.
## `findCreationOperation`
Reads one scoped operation.
## `completeCreation`
Persists created/reconciled evidence once.
## `markCreationUncertain`
Records retryable or action-required without creating again.
## `readSnapshot`
Reads state, candidates, and connection.
## `getSnapshot`
Returns current scoped state.
## `requireSnapshot`
Requires state after writes.
## `toCandidateParameter`
Builds a safe query record.
## `validateEvidenceSet`
Checks a bounded unique list.
## `validateEvidence`
Requires exact account-bound owner evidence.
## `decodeCreationOperation`
Reads ledger plus pre-create IDs.
## `decodeSetupSnapshot`
Reads safe state.
## `decodeConnection`
Reads stable connection metadata.
## `assertUuid`
Checks idempotency UUID.
## `assertVersionAndDate`
Checks version and time.
## `assertDate`
Checks a real Date.
## `isValidDate`
Recognizes valid Dates.
## `isBoundedText`
Checks bounded text.
## `readPositiveInteger`
Reads positive numbers.
## `readText`
Reads bounded database text.
## `readBoolean`
Reads exact booleans.
## `readDate`
Reads timezone-aware timestamps.
## `staleVersion`
Creates the safe version conflict.
## `invalidEvidence`
Creates the safe evidence error.
## `persistenceFailure`
Creates the generic storage error.
