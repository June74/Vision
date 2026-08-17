# `src/data/repositories/secretary-repository.ts`

`DrizzleSecretaryRepository` implements the local-secretary port over the
existing Neon/Drizzle database and wrapped data-key provider. Every SQL query
contains `owner_id`; protected text is encrypted with domain `personal` and
never becomes a query parameter. Task transitions are conditional updates.

## `SecretaryRepositoryError`

**Signature:** `new SecretaryRepositoryError()`

Emits only `Secretary persistence failed.`.

## `DrizzleSecretaryRepository`

**Signature:** `(database: VisionDatabase, keyProvider: KeyProvider)`

Binds the SQL and protected-field boundaries.

## `readToday`

**Signature:** `(ownerId, now, timeZone) => Promise<SecretaryTodaySource>`

Runs bounded owner-scoped capture/task/note reads, decrypts each envelope under
the exact owner/record/personal context, and returns no provider events by
itself.

## `createCapture`

**Signature:** `(ownerId, capture) => Promise<SecretaryCapture>`

Reclassifies the content, encrypts `content`, and inserts only safe kind,
ambiguity, identity, and timestamps as plaintext SQL values.

## `createTask`

**Signature:** `(ownerId, task) => Promise<SecretaryTask>`

Encrypts `title` and inserts due/timezone/status metadata. Non-open tasks are
rejected at this creation boundary.

## `transitionTask`

**Signature:** `(ownerId, taskId, action, at) => Promise<SecretaryTask | undefined>`

Updates only the expected prior status inside `owner_id AND id` scope, then
decrypts and returns the resulting row. A missing or foreign task is absent.

## `createNote`

**Signature:** `(ownerId, note) => Promise<SecretaryNote>`

Encrypts title/body and inserts an active owner-scoped note.

## `readCapture`

Decrypts one row and re-runs deterministic classification before returning it.

## `readTask`

Decrypts one title and validates status, due time, timezone, and completion
metadata.

## `readNote`

Requires active status, decrypts title/body, and validates both timestamps.

## `normalizeSecretaryError`

**Signature:** `(error: unknown) => Error`

Preserves only the safe repository error and hides SQL/crypto details.

## `secretaryFailure`

**Signature:** `() => SecretaryRepositoryError`

Creates the constant failure value.

## `assertOwnerId`

**Signature:** `(value: unknown) => asserts value is string`

Rejects empty/control-bearing/oversized owner IDs.

## `assertId`

**Signature:** `(value: unknown) => asserts value is string`

Validates the bounded local ID grammar.

## `readId`

**Signature:** `(value: unknown) => string`

Applies `assertId` to a database value.

## `assertDate`

**Signature:** `(value: unknown) => asserts value is Date`

Rejects invalid Date objects.

## `assertTimeZone`

**Signature:** `(value: unknown) => asserts value is string`

Validates an IANA timezone through `Intl.DateTimeFormat`.

## `parseDate`

**Signature:** `(value: unknown) => Date`

Accepts Date values or explicit-offset strings only.

## `readDatabaseBytes`

**Signature:** `(value: unknown) => string`

Decodes native `Uint8Array` and canonical `\\x...` PostgreSQL bytea text.

## `parseEnvelope`

**Signature:** `(value: string) => CipherEnvelope`

Strictly parses the bounded serialized protected-field envelope.

## `encodeEnvelope`

**Signature:** `(envelope: CipherEnvelope | null) => string`

Serializes a non-null validated envelope before bytea binding.
