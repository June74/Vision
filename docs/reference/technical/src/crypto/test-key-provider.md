# `src/crypto/test-key-provider.ts`

This module is a unit-test adapter around the production `WrappedKeyProvider`. It uses a fixed zero-byte base64url root labeled `TEST_ONLY_ROOT_KEY` and an in-memory `WrappedDataKeyStore`; neither is accepted from `RuntimeEnv`.

`TestKeyProviderOptions.environment` has the only legal type `"test"`, while `RuntimeEnv.VISION_ENV` is closed to `local | preview | production`. The factory repeats the check at runtime to reject type-cast production input. The harness exposes encrypted records but never raw or extractable data keys.

## `createTestKeyProvider`

**Signature:** `(options: TestKeyProviderOptions) => TestKeyProvider`

Rejects any runtime environment value other than `"test"` and returns a lazy test wrapper. `tests/unit/crypto/protected-fields.test.ts` directly exercises the production rejection.

## `getDataKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion?: number) => Promise<VersionedDataKey>`

Initializes the real `WrappedKeyProvider` once and delegates the exact production key resolution behavior.

## `rotateTo`

**Signature:** `(activeKeyVersion: number) => void`

Queues rotation before lazy initialization or applies it to the initialized provider. Production version monotonicity checks still run in `WrappedKeyProvider.rotateTo`.

## `readWrappedDataKeyForTest`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord | undefined>`

Reads only the wrapped ciphertext record. It exists for assertions about partitioning and does not expose root-key or plaintext data-key bytes.

## `getProvider`

**Signature:** `() => Promise<WrappedKeyProvider>`

Private lazy initializer that imports the fixed test root, retains one initialization promise, applies any queued rotation, and returns the production provider.

## `get`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord | undefined>`

Reads the in-memory map using the full partition tuple. It performs no plaintext or root-key operation.

## `putIfAbsent`

**Signature:** `(record: WrappedDataKeyRecord) => Promise<WrappedDataKeyRecord>`

Implements the store's atomic-first-writer semantics for single-threaded unit tests and returns the existing record on a duplicate partition.

## `createStoreKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => string`

JSON-encodes the three-position tuple, avoiding delimiter collisions in the in-memory test map.
