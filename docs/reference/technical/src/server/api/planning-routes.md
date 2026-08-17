# `src/server/api/planning-routes.ts`

These routes are the server-authoritative planning boundary. Calendar timing
facts are loaded from the owner-bound repository; request bodies contain only
the desired planning window and ambiguity. No route confirms a calendar change.

## `registerPlanningRoutes`

Registers `GET /api/planning/briefing`, `POST /api/planning/proposals`,
follow-up reads/creates, and `/api/planning/follow-ups/:followUpId/:action`.
Authenticated lookup precedes body parsing; every POST requires CSRF.

## `createProductionPlanningDependencies`

Reuses the wrapped-key, Neon, and auth composition from the local secretary
repository so follow-up text remains encrypted and owner-scoped.

## `resolvePlanningDependencies`

Converts resolver initialization failures into `PLANNING_UNAVAILABLE`.

## `authenticatePlanningRequest`

Reads the opaque session cookie, checks expiry through the encrypted session
repository, and sets the authenticated request context.

## `requirePlanningCsrf`

Verifies the request header against the decrypted session CSRF value.

## `readBoundedJson`

Limits JSON to 32 KiB, requires application/json, and uses fatal UTF-8 decode.

## `readDate`

Copies only finite server Date values.

## `readTimeZone`

Accepts an explicit valid IANA zone and rejects malformed queries.

## `readBriefingKind`

Restricts windows to morning, afternoon, evening, or custom.

## `createBriefingWindow`

Uses local boundaries and a DST-aware iterative conversion.

## `localDateKey`

Formats a date key with the caller's zone, not the Worker process zone.

## `get`

Reads one formatter component inside local-date/boundary conversion.

## `localBoundary`

Converts a local hour to an exact instant by correcting the UTC guess.

## `createId`

Validates an injected/test identity or generates a Worker UUID.

## `planningInvalid`

Maps malformed inputs to a stable 400 envelope.

## `planningConflict`

Maps missing/invalid follow-up transitions to a stable 409.

## `planningUnavailable`

Hides repository, SQL, crypto, and source details behind a stable 503.
