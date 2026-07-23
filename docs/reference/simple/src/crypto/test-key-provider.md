# `src/crypto/test-key-provider.ts`

This module makes the real wrapped-key behavior easy to exercise in unit tests. Its fixed root key and in-memory store are unmistakably test-only.

The factory requires `environment: "test"` at both the TypeScript and runtime boundaries. Vision's `RuntimeEnv` has no test value, so production configuration cannot select this provider.

## `createTestKeyProvider`

Creates a guarded test harness with an initial active version.

## `getDataKey`

Delegates test encryption and historical reads to the real wrapped-key provider.

## `rotateTo`

Moves the test harness to a newer active key version.

## `readWrappedDataKeyForTest`

Lets tests inspect only encrypted wrapped records for separation checks.

## `getProvider`

Creates the real wrapped provider lazily with the fixed test-only root.

## `get`

Reads one encrypted in-memory record by owner, domain, and version.

## `putIfAbsent`

Preserves the first encrypted record for a partition.

## `createStoreKey`

Builds an unambiguous in-memory partition key.
