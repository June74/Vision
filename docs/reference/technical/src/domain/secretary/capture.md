# `src/domain/secretary/capture.ts`

Pure input contract for local captures. Classification is deterministic and
prefix-based; it does not call an AI model, provider, or calendar write path.

## `classifyCapture`

**Signature:** `(input: unknown) => SecretaryCaptureClassification`

Trims and bounds text, maps explicit prefixes to task/note/calendar-candidate
kind, and returns `needs_clarification` for unprefixed input. Calendar output
contains only `{ canConfirm: false }` authority.

## `createSecretaryCapture`

**Signature:** `(input) => SecretaryCapture`

Validates the opaque identity and Date, then combines it with the deterministic
classification.

## `assertIdentity`

**Signature:** `(value: unknown) => asserts value is string`

Bounds the capture identity before protected-data context use.

## `assertDate`

**Signature:** `(value, message) => asserts value is Date`

Rejects invalid Date instances without string coercion.
