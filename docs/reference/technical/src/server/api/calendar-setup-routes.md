# Calendar setup routes

Reuses encrypted sessions/tokens and CSRF. Strict schemas accept only current version, exact phrase, UUID key, or explicit stable ID. Creation persists ledger and pre-create snapshot before Google.

## `registerCalendarSetupRoutes`
Registers routes before the fallback.
## `createProductionCalendarSetupDependencies`
Builds server-only production boundaries.
## `now`
Avoids stale timestamps.
## `createCalendarClient`
Binds provider evidence to the verified subject.
## `createRepository`
Captures owner and subject.
## `reconcileCreation`
Diffs valid owned IDs against the durable snapshot; never calls insert again.
## `authenticateSetupRequest`
Resolves exactly one opaque cookie server-side.
## `requireCsrf`
Uses constant-time verification.
## `resolveCalendarClient`
Rejects absent or expired access tokens.
## `resolveSetupDependencies`
Collapses initialization details.
## `readSetupJson`
Requires JSON and an 8 KiB maximum before strict Zod parsing.
## `withVerificationTime`
Copies evidence with an intrinsic Date.
## `bindVerificationTime`
Caps candidates at 100.
## `toSetupResponse`
Excludes subject, token, and operation internals.
## `requireSetupSnapshot`
Returns completed replays without provider calls.
## `mapRepositoryFailure`
Exposes only stale-version conflicts.
## `logCalendarEventSafely`
Never logs IDs, keys, bodies, or tokens.
## `noStore`
Sets `Cache-Control: no-store`.
## `invalidSetupRequest`
Throws constant `INVALID_SETUP_REQUEST`.
## `providerUnavailable`
Throws constant `CALENDAR_SETUP_UNAVAILABLE`.
