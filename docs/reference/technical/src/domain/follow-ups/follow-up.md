# `src/domain/follow-ups/follow-up.ts`

The follow-up domain is provider-neutral and deterministic. Its transitions
carry no calendar identity, operation ID, or confirmation capability.

## `createFollowUp`

Validates bounded identity/title/source IDs, explicit timezone, nullable due
time, and creates an open record whose initial `updatedAt` equals `createdAt`.

## `transitionFollowUp`

Supports complete from open/snoozed, reopen from completed, and snooze with a
future explicit instant. Invalid or repeated transitions raise a safe domain
error.

## `updated`

Copies immutable record fields while using the exact caller transition instant.

## `assertFollowUp`

Checks the minimum persisted status union.

## `toDate`

Copies Date/string creation input and rejects invalid instants.

## `assertDate`

Rejects invalid transition instants without coercion.

## `validateTimeZone`

Uses `Intl.DateTimeFormat` to validate an explicit IANA zone.
