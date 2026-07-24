# `src/domain/sync/checkpoint.ts`

Defines the closed provider-neutral synchronization checkpoint. It is an in-memory and job contract; the persistence adapter is responsible for encrypting the opaque token before storage.

## `SyncCheckpointSchema`

Requires a non-empty calendar ID and sync token, an offset-aware commit instant, and a positive version. Strict parsing rejects provider fields and unknown structure so jobs cannot silently depend on a Google-specific checkpoint representation.
