# `src/domain/secretary/task.ts`

Pure local task value object. It has no provider identity and its transitions
are explicit `open -> completed` or `completed -> open` operations.

## `createSecretaryTask`

**Signature:** `(input) => SecretaryTask`

Validates bounded title/id, explicit timestamp syntax, IANA timezone, and
creates an open task with `completedAt: null`.

## `transitionSecretaryTask`

**Signature:** `(task, action, at) => SecretaryTask`

Allows only the matching lifecycle transition and returns an immutable copy.

## `assertIdentity`

**Signature:** `(value: unknown) => asserts value is string`

Bounds an opaque task ID.

## `readText`

**Signature:** `(value, maximum) => string`

Trims and bounds protected task title text.

## `assertDate`

**Signature:** `(value: unknown) => asserts value is Date`

Rejects invalid Date objects.

## `assertIsoDate`

**Signature:** `(value: unknown) => asserts value is string`

Requires an explicit UTC offset or `Z` suffix.

## `assertTimeZone`

**Signature:** `(value: unknown) => asserts value is string`

Validates the IANA zone through `Intl.DateTimeFormat`.
