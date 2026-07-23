# `src/crypto/test-key-provider.ts`

This module is a unit-test adapter around the production `WrappedKeyProvider`. It contains no root key. Each test supplies randomly generated or explicit test-only base64url key material, and the in-memory store implements the same wrapped-record and active-version contracts.

Construction requires both `NODE_ENV=test` and `VITEST=true`. More importantly, `scripts/validate-production-crypto-boundary.ts` rejects any other production source reference to this module, and `pnpm build` scans the actual Worker output for its unique marker, factory name, and module name.

## `createTestKeyProvider`

**Signature:** `(options: TestKeyProviderOptions) => Promise<TestKeyProvider>`

Runs the Vitest sentinel gate, constructs a fresh in-memory store, and awaits the real provider factory using caller-supplied key material. No known key exists in production source.

## `getDataKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion?: number) => Promise<VersionedDataKey>`

Delegates exact production key resolution behavior.

## `rotateTo`

**Signature:** `(activeKeyVersion: number) => Promise<void>`

Delegates asynchronous, store-authorized monotonic rotation.

## `readWrappedDataKeyForTest`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord | undefined>`

Reads only the wrapped ciphertext record. It exists for assertions about partitioning and does not expose root-key or plaintext data-key bytes.

## `get`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => Promise<WrappedDataKeyRecord | undefined>`

Reads the in-memory map using the full partition tuple. It performs no plaintext or root-key operation.

## `putIfAbsent`

**Signature:** `(record: WrappedDataKeyRecord) => Promise<WrappedDataKeyRecord>`

Implements the store's atomic-first-writer semantics for single-threaded unit tests and returns the existing record on a duplicate partition.

## `getActiveKeyVersion`

**Signature:** `() => Promise<number | undefined>`

Reads the in-memory authoritative high-water mark used by every versionless provider lookup.

## `activateKeyVersion`

**Signature:** `(candidate: number) => Promise<number>`

Atomically applies `max(current, candidate)` in the single-threaded test store and returns the authoritative result, matching the required durable-store contract.

## `assertVitestRuntime`

**Signature:** `() => void`

Requires both process sentinels set by Vitest. Its constant failure includes the bundle marker so any accidental production inclusion is detectable after build.

## `createStoreKey`

**Signature:** `(ownerId: string, domain: Domain, keyVersion: number) => string`

JSON-encodes the three-position tuple, avoiding delimiter collisions in the in-memory test map.
