# `src/client/secretary/api.ts`

These helpers read Vision-local Today data and submit captures, tasks, notes,
and reversible task transitions. Calendar candidates are returned as pending
approval markers only.

## `readSecretaryToday`

Reads the owner’s timezone-aware local Today projection.

## `createSecretaryCapture`

Stores one capture with CSRF protection and returns its deterministic local
classification.

## `createSecretaryTask`

Creates a local task without creating a provider event.

## `transitionSecretaryTask`

Completes or reopens one owner-scoped task.

## `createSecretaryNote`

Stores one protected local note through the authenticated route.

## `readPayload`

Rejects non-success responses and passes only JSON payloads to a strict parser.

## `parseToday`

Validates the Today envelope and its read-only event boundary.

## `parseCaptureEnvelope`

Validates one capture response envelope.

## `parseTaskEnvelope`

Validates one task response envelope.

## `parseNoteEnvelope`

Validates one note response envelope.

## `isCapture`

Checks bounded capture fields and the optional pending calendar marker.

## `isCalendarProposal`

Accepts only the non-confirmable calendar proposal descriptor.

## `isTask`

Checks the local task lifecycle and timestamps.

## `isNote`

Checks the protected-note display fields.

## `isEvent`

Requires calendar events to remain read-only in Today.

## `isRecord`

Narrows unknown JSON to a non-array record.

## `isOneOf`

Checks a value against a closed public string union.
