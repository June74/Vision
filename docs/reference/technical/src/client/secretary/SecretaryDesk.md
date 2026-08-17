# `src/client/secretary/SecretaryDesk.tsx`

React presentation boundary for Vision-local secretary records. It loads Today
with the browser IANA timezone, keeps local mutations in the authenticated API
surface, and does not import calendar-write confirmation helpers.

## `SecretaryDesk`

**Signature:** `({ session }: { session: BrowserSession }) => JSX.Element`

Owns local Today/capture/task/note state. It updates the visible projection
only with server-returned local records and labels all calendar candidates as
approval-required.

## `submitCapture`

**Signature:** `(event: FormEvent<HTMLFormElement>) => Promise<void>`

Posts one capture, appends the returned record, and never exposes a confirm
operation for a calendar candidate.

## `submitTask`

**Signature:** `(event: FormEvent<HTMLFormElement>) => Promise<void>`

Posts a local task with a nullable due time and browser timezone.

## `submitNote`

**Signature:** `(event: FormEvent<HTMLFormElement>) => Promise<void>`

Posts title/body to the protected-note route and appends only the returned
owner-visible record.

## `changeTask`

**Signature:** `(task: SecretaryTask) => Promise<void>`

Requests exactly one complete/undo transition and replaces the matching local
task with its server result.

## `CaptureLedger`

**Signature:** `({ captures }) => JSX.Element | null`

Renders bounded recent capture content and the explicit non-confirmable
calendar candidate marker.

## `NoteLedger`

**Signature:** `({ notes }) => JSX.Element | null`

Renders protected note fields only after authenticated API validation.
