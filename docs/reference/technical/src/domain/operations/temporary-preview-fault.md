# `src/domain/operations/temporary-preview-fault.ts`

Owns the frozen six-value preview-only scenario vocabulary and pure
`FoundationHealthFacts` overlays. A separate frozen eight-value selector
vocabulary adds `foundation_probe` and `ai_usage` without widening the fault
tuple.

## `parseTemporaryPreviewAcceptanceSelector`

Returns one of the eight generated candidate selectors only in preview.
Missing remains normal; malformed, unknown, multiple, or production activation
throws before dependency access.

## `parseTemporaryPreviewAcceptanceAiGatewayAttestation`

Returns true only when `ai_usage` carries the exact string `"true"`. It rejects
a missing AI attestation and any attestation on a non-AI selector.

## `parseTemporaryPreviewFaultScenario`

Returns an admitted `PREVIEW_ACCEPTANCE_SCENARIO` only when `VISION_ENV` is
`preview`; missing is normal, while any supplied malformed, unknown, multiple,
or production value throws before dependency access.

## `applyTemporaryPreviewFaultOverlay`

Returns a frozen copy for queue delay, failed job, expired channel, unavailable
database, or the real 950-cent AI hard stop. `r2_upload_failed` returns the
original diagnostic facts because its boundary is scheduled backup writing.

## `invalidScenario`

Creates the value-free invalid-binding error.

## `invalidAiAttestation`

Creates the value-free invalid-AI-attestation error.
