# `src/client/secretary/SecretaryDesk.tsx`

The local secretary desk presents Today, capture, tasks, and protected notes
inside the authenticated calendar desk. A calendar candidate is shown as
approval-required and never gets a confirm button.

## `SecretaryDesk`

Renders the local workspace and sends only local secretary actions.

## `submitCapture`

Saves a capture and displays whether it is local, ambiguous, or a pending
calendar candidate.

## `submitTask`

Adds a local task with the browser timezone.

## `submitNote`

Saves a protected local note.

## `changeTask`

Applies the server-confirmed complete or undo transition.

## `CaptureLedger`

Shows recent captures and their non-confirmable calendar status.

## `NoteLedger`

Shows recent notes returned for the authenticated owner.
