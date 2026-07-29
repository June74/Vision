# `src/domain/operations/temporary-preview-fault.ts`

Contains the preview-only switch used to show safe operational failure states.
It cannot read the browser request, database, Queue, provider, or AI output.

## `parseTemporaryPreviewFaultScenario`

Accepts one generated preview scenario. An absent binding leaves normal
diagnostics alone; malformed or non-preview activation is rejected.

## `applyTemporaryPreviewFaultOverlay`

Creates a new set of diagnostic facts after the user is authenticated. It only
changes the small fact needed for the selected display state. R2 failure keeps
diagnostic reads normal.

## `invalidScenario`

Returns the one safe error used for invalid temporary configuration.
