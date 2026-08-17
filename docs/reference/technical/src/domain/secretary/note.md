# `src/domain/secretary/note.ts`

Pure local note value object. Encryption is deliberately deferred to the
repository boundary.

## `createSecretaryNote`

**Signature:** `(input) => SecretaryNote`

Validates bounded identity/title/body and emits an active note with exact ISO
timestamps.

## `assertIdentity`

**Signature:** `(value: unknown) => asserts value is string`

Bounds the opaque note ID.

## `readText`

**Signature:** `(value, maximum) => string`

Trims and bounds protected note text without coercion.
