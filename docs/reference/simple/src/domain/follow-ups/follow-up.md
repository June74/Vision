# `src/domain/follow-ups/follow-up.ts`

Creates local follow-ups and applies complete, reopen, or snooze actions.

## `createFollowUp`

Creates an open follow-up.

## `transitionFollowUp`

Applies one valid lifecycle action.

## `updated`

Copies a follow-up with a new state and timestamp.

## `assertFollowUp`

Checks the lifecycle shape.

## `toDate`

Copies and validates a creation date.

## `assertDate`

Rejects invalid transition dates.

## `validateTimeZone`

Checks an IANA timezone.
