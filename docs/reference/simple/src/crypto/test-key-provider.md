# `src/crypto/test-key-provider.ts`

This module makes the real wrapped-key behavior easy to exercise in unit tests without storing a known key in source.

Tests must supply freshly generated or explicit test key material. Construction also requires the actual Vitest process sentinels. A repository scan forbids production imports, and every production build scans the Worker bundle for this module's marker and helper name.

## `createTestKeyProvider`

Asynchronously creates a guarded test harness from caller-provided test key material.

## `getDataKey`

Delegates test encryption and historical reads to the real wrapped-key provider.

## `rotateTo`

Atomically moves the test store to a newer active key version.

## `readWrappedDataKeyForTest`

Lets tests inspect only encrypted wrapped records for separation checks.

## `get`

Reads one encrypted in-memory record by owner, domain, and version.

## `putIfAbsent`

Preserves the first encrypted record for a partition.

## `getActiveKeyVersion`

Reads the in-memory active-version high-water mark.

## `activateKeyVersion`

Raises the in-memory high-water mark without allowing rollback.

## `assertVitestRuntime`

Requires both Node test mode and Vitest's runtime sentinel.

## `createStoreKey`

Builds an unambiguous in-memory partition key.
