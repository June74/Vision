# `src/data/repositories/secretary-repository.ts`

This repository keeps local secretary content encrypted and applies owner scope
to every read and transition. Today reads local captures, tasks, and notes;
calendar events are supplied separately as read-only facts.

## `SecretaryRepositoryError`

Represents a constant local-secretary persistence failure.

## `DrizzleSecretaryRepository`

Implements encrypted local capture, task, note, and task-transition storage.

## `readToday`

Reads owner-local records for the Today projection.

## `readPlanning`

Reads planning-safe event timing and local task/follow-up facts for one owner.

## `createFollowUp`

Stores one encrypted local follow-up.

## `transitionFollowUp`

Applies one complete, reopen, or snooze transition within owner scope.

## `readFollowUp`

Decrypts and validates one follow-up row.

## `planningEventFromRow`

Converts one planning-only event row into safe timing metadata.

## `createCapture`

Encrypts capture content before insertion.

## `createTask`

Encrypts the task title while keeping due metadata queryable.

## `transitionTask`

Completes or undoes a task with owner-scoped compare-and-set behavior.

## `createNote`

Encrypts note title and body before insertion.

## `readCapture`

Decrypts and reclassifies one capture row.

## `readTask`

Decrypts one task title and validates lifecycle metadata.

## `readNote`

Decrypts one active note row.

## `normalizeSecretaryError`

Collapses low-level failures to the constant repository error.

## `secretaryFailure`

Creates the constant persistence error.

## `assertOwnerId`

Bounds owner identity before SQL and crypto use.

## `assertId`

Bounds local record identity.

## `readId`

Reads one bounded database identity.

## `assertDate`

Checks an explicit Date value.

## `assertTimeZone`

Checks an IANA timezone.

## `parseDate`

Parses Date values or explicit-offset database timestamps.

## `readDatabaseBytes`

Decodes native or PostgreSQL bytea content.

## `parseEnvelope`

Validates one serialized cipher envelope.

## `encodeEnvelope`

Serializes one protected-field envelope for bytea storage.
