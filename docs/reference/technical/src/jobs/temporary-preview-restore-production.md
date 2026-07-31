# temporary-preview-restore-production

Composes restore without accepting a broad Worker environment or mutable backup bucket.

## `runProductionTemporaryPreviewRestore`
Exports the exact `TemporaryPreviewRestoreRuntimeInput` boundary: the literal
preview environment, disposable restore database and target inputs, encoded
backup key plus string key version, read-only catalog, and `claimOnce` attempt
fence. It rejects every key version except `1`, imports the opaque key
internally, constructs clear/create/read-back capabilities internally, and
passes only those narrow capabilities to the domain restore. A nullable
non-owner result never escapes the facade; callers receive closed evidence or
a safe exception.

## `clearTarget`
Constructs the clear adapter inside the facade and passes it only the runtime
database binding, target identity, and prepared authoritative row counts.

## `createTarget`
Constructs a disposable preview `ManagedBackupRestoreTarget` internally; this
capability is not accepted from the facade caller.

## `readTargetSnapshot`
Reads and caches one consistent `BackupSnapshotV1` from the admitted target for
independent post-restore verification.

## `countReadableEvents`
Uses the cached read-back when present, or performs one consistent snapshot
read, and returns only the audit-event count to the domain restore.
