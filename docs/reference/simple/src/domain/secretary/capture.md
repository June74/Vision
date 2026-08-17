# `src/domain/secretary/capture.ts`

Classifies local captures by explicit `task:`, `note:`, or `calendar:` prefixes.
Unprefixed text stays ambiguous; a calendar candidate is never confirmed here.

## `classifyCapture`

Returns a bounded local classification and an optional non-confirmable calendar
proposal marker.

## `createSecretaryCapture`

Adds an opaque identity and timestamp to a classified capture.

## `assertIdentity`

Checks the local opaque capture identity.

## `assertDate`

Checks the capture timestamp.
