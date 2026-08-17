# `src/domain/secretary/task.ts`

Defines local open/completed tasks with reversible completion.

## `createSecretaryTask`

Creates an open task with optional exact due time and IANA timezone.

## `transitionSecretaryTask`

Completes an open task or reopens a completed task.

## `assertIdentity`

Checks the task identity.

## `readText`

Checks a bounded nonempty task title.

## `assertDate`

Checks a Date value.

## `assertIsoDate`

Requires an offset-bearing timestamp.

## `assertTimeZone`

Rejects an invalid IANA timezone.
