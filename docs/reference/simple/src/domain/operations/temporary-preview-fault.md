# `src/domain/operations/temporary-preview-fault.ts`

Contains the preview-only candidate switches used to produce closed acceptance
evidence or show safe operational failure states. It cannot read the browser
request, database, Queue, provider, or AI output.

## `parseTemporaryPreviewAcceptanceSelector`

Accepts one exact generated preview selector from the six faults plus the
foundation and AI evidence candidates.

## `parseTemporaryPreviewAcceptanceAiGatewayAttestation`

Requires the exact same-run attestation only for the AI evidence selector and
rejects it everywhere else.

## `parseTemporaryPreviewFaultScenario`

Accepts one generated preview scenario. An absent binding leaves normal
diagnostics alone; malformed or non-preview activation is rejected.

## `applyTemporaryPreviewFaultOverlay`

Creates a new set of diagnostic facts after the user is authenticated. It only
changes the small fact needed for the selected display state. R2 failure keeps
diagnostic reads normal.

## `invalidScenario`

Returns the one safe error used for invalid temporary configuration.

## `invalidAiAttestation`

Returns the one safe error used for invalid AI attestation.
