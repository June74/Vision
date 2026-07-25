# `src/domain/backup/manifest.ts`

Defines backup format version 1, the current database version, every authoritative table, and the encrypted
manifest's safe recovery facts.

## `createBackupManifest`

Builds the current manifest and validates every value before returning it.

## `validateBackupManifest`

Rejects unknown fields, missing table counts, unsupported versions, malformed times, checksums, or key versions.

## `requirePlainRecord`

Accepts only ordinary data objects without getters or hidden properties.

## `requireExactKeys`

Requires an object's property names to match the closed versioned contract.
