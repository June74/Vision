# `src/server/api/planning-routes.ts`

Planning routes authenticate first, load owner-scoped source facts, require
CSRF for local writes, and return only deterministic/approval-required results.

## `registerPlanningRoutes`

Mounts briefing, proposal, follow-up list, create, and transition routes.

## `createProductionPlanningDependencies`

Connects planning to the existing authenticated secretary repository.

## `resolvePlanningDependencies`

Resolves route dependencies safely.

## `authenticatePlanningRequest`

Authenticates before source or body access.

## `requirePlanningCsrf`

Protects local writes.

## `readBoundedJson`

Reads a small strict JSON body.

## `readDate`

Copies a valid server date.

## `readTimeZone`

Validates an IANA timezone.

## `readBriefingKind`

Checks the briefing window union.

## `createBriefingWindow`

Builds exact local-date window bounds.

## `localDateKey`

Produces a timezone-aware date key.

## `get`

Reads a formatted local date component.

## `localBoundary`

Converts a local clock boundary with DST correction.

## `createId`

Creates an opaque route identity.

## `planningInvalid`

Returns the safe malformed-planning error.

## `planningConflict`

Returns the safe lifecycle conflict.

## `planningUnavailable`

Returns the safe availability error.
