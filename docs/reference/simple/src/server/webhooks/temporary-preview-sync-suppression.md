# `src/server/webhooks/temporary-preview-sync-suppression.ts`

This temporary preview-only helper decides whether one fully verified new Google notification may skip the normal durable Queue path and emits a content-free acceptance record.

## `resolveTemporarySyncSuppressionState`

Returns `inactive` when the selector is absent or names another valid candidate, `active` for an unexpired synchronization-suppression pair, and `expired` once that pair has elapsed. Malformed pairing throws one safe error.

## `emitTemporarySyncSuppressionEvidence`

Writes one deeply frozen record containing only the fixed action, evidence type, and suppressed outcome.

## `readDate`

Accepts only a genuine finite execution clock.

## `invalidConfiguration`

Creates the single content-free malformed-configuration error.
