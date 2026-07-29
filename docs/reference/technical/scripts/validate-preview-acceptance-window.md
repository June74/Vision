# `scripts/validate-preview-acceptance-window.ts`

Implements the fail-closed time guard used before candidate preparation and
again immediately before preview deployment. The protected range is
inclusive at its start and exclusive at its end.

## `assertPreviewAcceptanceWindow`

Validates the `Date`, derives its UTC minute of day, and rejects every instant
inside the recovery overlap range with one constant error.

## `main`

Rejects caller-controlled arguments, evaluates the current time, and maps all
failures to one non-sensitive message and nonzero exit status.
