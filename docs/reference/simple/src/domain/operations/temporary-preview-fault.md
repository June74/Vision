# `src/domain/operations/temporary-preview-fault.ts`

## `previewAcceptanceMaxLifetimeMinutes`

Returns ten minutes only for synchronization suppression and thirty minutes
for every other admitted preview acceptance selector.

Contains the preview-only candidate switches used to produce closed acceptance
evidence or show safe operational failure states. It cannot read the browser
request, database, Queue, provider, or AI output.

## `assertPreviewAcceptanceWindow`

Rejects an instant inside the protected daily recovery window.

## `createPreviewAcceptanceDeadline`

Creates the canonical maximum expiry for one safely activated candidate.

## `assertPreviewAcceptanceLifetime`

Rejects an expired, malformed, overlong, or recovery-overlapping interval.

## `assertTemporaryPreviewAcceptanceLifetime`

Applies the lifetime check only when a temporary selector is active.

## `validAcceptanceInstant`

Converts a valid clock instant to milliseconds or fails closed.

## `assertAvailableAcceptanceInterval`

Rejects any interval that crosses the protected window, including across
midnight.

## `parseTemporaryPreviewAcceptanceSelector`

Accepts one exact generated preview selector from the six faults plus the
foundation, AI evidence, and synchronization-suppression candidates.

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

## `createPreviewAiEvidenceWindow`

Creates one frozen 30-minute AI window with a single canonical UTC-minute
evidence instant. It shifts an exact-minute generated expiry forward by one
millisecond and rejects Chicago-month or permanent-schedule overlap.

## `parseTemporaryPreviewAiEvidenceWindow`

Reads only own scalar AI-window bindings from an ordinary record, rejects
inherited, hidden, accessor-backed, or hostile reflection input with one safe
error, rejects strict-boundary equality, and returns detached frozen dates.

## `assertPreviewAiRequestMargin`

Requires at least 90 seconds before the sole AI evidence instant.

## `validatedPreviewAiEvidenceWindow`

Applies the exact lifetime, minute, ordering, Chicago-month, recovery, and
rollback-schedule rules shared by generation and parsing.

## `assertAiRollbackAvoidsPermanentSchedules`

Validates an expiry and rejects it when rollback extends across a permanent
quarter-hour or daily schedule. Ending exactly at the tick remains safe.

## `ownDataValue`

Reads one own enumerable data property without invoking accessors.

## `canonicalInstant`

Accepts only one byte-stable UTC timestamp string.

## `invalidAiWindow`

Returns the one safe error used for invalid AI-window configuration.
