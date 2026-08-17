# `src/client/secretary/api.ts`

This is the browser-side adapter for `/api/secretary/today`, capture, task,
transition, and note routes. It uses same-origin credentials, adds the session
CSRF token to writes, rejects malformed response graphs, and deliberately has
no function for confirming a calendar proposal.

## `readSecretaryToday`

**Signature:** `(timeZone: string) => Promise<SecretaryToday>`

URL-encodes an explicit IANA timezone and accepts only the server’s local
Today projection.

## `createSecretaryCapture`

**Signature:** `(session, content: string) => Promise<SecretaryCapture>`

POSTs one capture with `x-vision-csrf` and parses the owner-visible
classification. A calendar candidate can carry only `canConfirm: false`.

## `createSecretaryTask`

**Signature:** `(session, input) => Promise<SecretaryTask>`

POSTs exact title, nullable due time, and timezone metadata; it never carries a
provider calendar ID or operation handle.

## `transitionSecretaryTask`

**Signature:** `(session, taskId, action) => Promise<SecretaryTask>`

Sends one CSRF-protected `complete` or `undo` action to an owner-scoped route.

## `createSecretaryNote`

**Signature:** `(session, input) => Promise<SecretaryNote>`

Sends protected note content only to the authenticated local-note route.

## `readPayload`

**Signature:** `(response, parser) => Promise<T>`

Rejects non-2xx responses and delegates untrusted JSON to a type-specific
allowlist parser.

## `parseToday`

**Signature:** `(value: unknown) => SecretaryToday`

Requires the approval-required calendar boundary, bounded local arrays, and
read-only event descriptors.

## `parseCaptureEnvelope`

**Signature:** `(value: unknown) => SecretaryCapture`

Requires a capture wrapper and the strict capture/marker graph.

## `parseTaskEnvelope`

**Signature:** `(value: unknown) => SecretaryTask`

Requires a task wrapper and the open/completed lifecycle union.

## `parseNoteEnvelope`

**Signature:** `(value: unknown) => SecretaryNote`

Requires an active note wrapper with bounded string fields.

## `isCapture`

**Signature:** `(value: unknown) => value is SecretaryCapture`

Checks bounded capture identity/content, classification, ambiguity, and the
non-confirmable calendar marker.

## `isCalendarProposal`

**Signature:** `(value: unknown) => value is SecretaryCalendarProposalMarker`

Requires `action=create`, `status=pending_approval`, explicit approval, and
`canConfirm=false`.

## `isTask`

**Signature:** `(value: unknown) => value is SecretaryTask`

Checks task identity, title, due timestamp, timezone, lifecycle, and completion
timestamp shape.

## `isNote`

**Signature:** `(value: unknown) => value is SecretaryNote`

Checks the active note descriptor.

## `isEvent`

**Signature:** `(value: unknown) => value is SecretaryTodayEvent`

Requires `readOnly=true` and `canWrite=false` for every calendar event.

## `isRecord`

**Signature:** `(value: unknown) => value is Record<string, unknown>`

Excludes arrays from JSON property-bag parsing.

## `isOneOf`

**Signature:** `(value, allowed) => value is Value`

Provides the closed-union predicate used by every public parser.
