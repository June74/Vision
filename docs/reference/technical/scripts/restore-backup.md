# `scripts/restore-backup.ts`

Implements a fail-closed operator boundary around the Task 1 importer and the concrete PostgreSQL adapter. It never
accepts production and never emits object bodies, credentials, URLs, target secrets, or row content.

## `runRestoreBackupCommand`

Parses policy before external I/O, validates the separate backup key and least-privileged preview URL, performs the
shared stored-object verifier, and delegates the already-verified encrypted envelope to the transactional restore.
Output is restricted to plaintext SHA-256, complete row counts, and replacement status.

## `parseArguments`

Rejects unknown, duplicate, and missing options; requires `--target preview`, the exact disposable-target confirmation,
and the fixed versioned object-key grammar. Nonempty replacement also carries the asserted target ID to Task 1.

## `createCloudflareR2BackupObjectReader`

Requires a valid account ID, API token, and the exact private preview bucket. It issues authenticated GET requests
without logging request details or credential-bearing headers and implements only the shared read-only object port.

## `read`

Encodes each object-key segment while preserving path separators, maps 404 to absence, bounds body size, and never
returns response error bodies.

## `head`

Performs the first independent authenticated read, preserves its identity and verification metadata, and cancels the
unused body.

## `get`

Performs the second authenticated read and returns owned bounded bytes with identity and verification metadata.

## `parseCloudflareObjectHeaders`

Requires a quoted ETag, maps only `x-amz-meta-*` fields, and requires a consistent native SHA-256 response header.
Unknown metadata is preserved so the shared closed-metadata validator rejects it.

## `parseNativeSha256`

Requires canonical standard Base64 representing exactly 32 bytes and converts it to base64url for the shared verifier.

## `productionDependencies`

Assembles the Cloudflare API reader, disposable Neon preview target, and sanitized output boundary.

## `createTarget`

Binds the validated preview URL and expected target ID to the Neon adapter. The adapter treats these as assertions
and independently reads disposable-preview identity, migration digest, and revision from the connected database
before staging.

## `writeOutput`

Writes only the sanitized report JSON prepared by the command.

## `main`

Runs the command with process arguments/environment and reduces all failures to `Backup restore failed.`.
