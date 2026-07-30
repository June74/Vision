# `src/server/webhooks/temporary-preview-sync-suppression.ts`

The module is a temporary preview-only decision and evidence boundary. It accepts no request, header, channel, calendar, message, account, or provider data. The dedicated selector remains outside the six-value fault tuple.

## `resolveTemporarySyncSuppressionState`

Validates a genuine finite clock and an exact selector/expiry pairing. Both bindings absent means `inactive`; a canonical preview pair for another admitted selector also means `inactive`. The exact `sync_suppression` pair is `active` only while its canonical UTC expiry is strictly later than the supplied post-replay clock and becomes `expired` at or after that instant. Missing halves, invalid selectors, non-preview activation, and malformed timestamps collapse to one constant safe error.

## `emitTemporarySyncSuppressionEvidence`

Passes one shared deeply frozen exact-key terminal to an optional writer that defaults to `console.info`. The envelope has only `action=acceptance.sync-suppression`; its nested evidence has only `evidenceType=vision.sync-suppression/v1` and `outcome=suppressed`.

## `readDate`

Invokes the trusted `Date` intrinsic and accepts only a finite millisecond instant, preventing forged or invalid clock objects from influencing the selector.

## `invalidConfiguration`

Constructs the sole fixed malformed-binding error so protected configuration cannot influence thrown text.
