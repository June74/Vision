# `scripts/restore-backup.ts`

Implements a fail-closed operator boundary around the Task 1 importer and the concrete PostgreSQL adapter. It never
accepts production and never emits object bodies, credentials, URLs, target secrets, or row content.

## `runRestoreBackupCommand`

Parses policy before external I/O, validates the separate backup key and least-privileged preview URL, retrieves one
closed-path object, parses its canonical envelope, imports the non-extractable key, and delegates the transactional
restore. Output is restricted to plaintext SHA-256, complete row counts, and replacement status.

## `parseArguments`

Rejects unknown, duplicate, and missing options; requires `--target preview`, the exact disposable-target confirmation,
and the fixed versioned object-key grammar. Nonempty replacement also carries the asserted target ID to Task 1.

## `readBackupObjectWithWrangler`

Invokes the repository-local Wrangler binary with an argument array, downloads from the fixed private bucket into an
owned temporary directory, caps process output, hides the Windows console, and removes the directory in `finally`.

## `productionDependencies`

Assembles only the three side-effect boundaries required by the process entry.

## `createTarget`

Binds the validated preview URL and expected target ID to the Neon adapter. The adapter treats these as assertions
and independently reads disposable-preview identity, migration digest, and revision from the connected database
before staging.

## `writeOutput`

Writes only the sanitized report JSON prepared by the command.

## `main`

Runs the command with process arguments/environment and reduces all failures to `Backup restore failed.`.
