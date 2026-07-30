# `src/domain/operations/temporary-preview-fault.ts`

## `previewAcceptanceMaxLifetimeMinutes`

Maps the closed acceptance-selector union to the exact `10 | 30` lifetime used
by both construction-time and execution-time protected-window checks.

Owns the frozen six-value preview-only scenario vocabulary and pure
`FoundationHealthFacts` overlays. A separate frozen nine-value selector
vocabulary adds `foundation_probe`, `ai_usage`, and `sync_suppression` without
widening the fault tuple.

## `assertPreviewAcceptanceWindow`

Validates a `Date` and rejects minutes in the inclusive-start,
exclusive-end protected UTC range.

## `createPreviewAcceptanceDeadline`

First proves the full maximum interval is safe, then returns its canonical UTC
expiry.

## `assertPreviewAcceptanceLifetime`

Requires ordered canonical instants, a positive lifetime within the maximum,
no expiry at evaluation time, and no intersection with the protected window.

## `assertTemporaryPreviewAcceptanceLifetime`

Leaves the permanent normal scheduler untouched and applies the exact deadline
contract before temporary dependencies are resolved.

## `validAcceptanceInstant`

Uses the intrinsic `Date` getter and rejects non-finite or forged inputs.

## `assertAvailableAcceptanceInterval`

Projects an interval across adjacent UTC days and rejects every overlap with
the protected daily range.

## `parseTemporaryPreviewAcceptanceSelector`

Returns one of the nine generated candidate selectors only in preview.
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
