# `src/domain/operations/temporary-preview-fault.ts`

Owns the frozen six-value preview-only scenario vocabulary and pure
`FoundationHealthFacts` overlays.

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
