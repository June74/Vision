# Calendar setup routes

GET reads the setup snapshot only. A CSRF-protected discovery POST refreshes choices; later POSTs select an explicit stable ID or create after the exact phrase.

## `registerCalendarSetupRoutes`
Registers read-only snapshot, discovery, selection, and creation APIs.
## `createProductionCalendarSetupDependencies`
Connects auth, database, Google, and time zone.
## `now`
Reads current time.
## `createCalendarClient`
Creates the account-bound adapter.
## `createRepository`
Creates the owner-bound repository.
## `reconcileCreation`
Connects one new ID, waits for zero, or requires action for many.
## `authenticateSetupRequest`
Requires an active session.
## `requireCsrf`
Protects POST requests.
## `resolveCalendarClient`
Requires a current access token.
## `resolveSetupDependencies`
Hides configuration failures.
## `readSetupJson`
Reads small strict JSON.
## `withVerificationTime`
Adds server verification time.
## `bindVerificationTime`
Snapshots candidates.
## `toSetupResponse`
Returns safe client fields.
## `requireSetupSnapshot`
Supports idempotent replay.
## `mapRepositoryFailure`
Maps version conflicts safely.
## `logCalendarEventSafely`
Writes fixed audit facts.
## `noStore`
Disables caching.
## `invalidSetupRequest`
Returns the safe input error.
## `providerUnavailable`
Returns the safe availability error.
## `initialSetupSnapshot`
Returns the read-only initial state before the first discovery.
