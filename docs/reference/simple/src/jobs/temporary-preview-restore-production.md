# temporary-preview-restore-production

Connects temporary restore to explicit values and narrow capabilities.

## `runProductionTemporaryPreviewRestore`
Runs the one-shot preview restore through one fixed preview-only input.
It accepts the disposable restore binding, backup key material with required
version `1`, a read-only backup catalog, and the one-time attempt fence. The
database adapters and opaque imported key stay inside this production facade,
which returns one closed restore evidence record or throws a safe error.

## `clearTarget`
Builds the internal adapter that clears only the admitted disposable target
after its expected row counts are checked.

## `createTarget`
Opens only the admitted disposable preview restore target.

## `readTargetSnapshot`
Reads one consistent snapshot back from the restored target.

## `countReadableEvents`
Counts readable audit events from the already-read snapshot when available,
otherwise from one consistent read-back.
