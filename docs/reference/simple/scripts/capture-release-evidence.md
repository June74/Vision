# Release evidence capture

This script creates the privacy evidence used by Vision's release check. It sends safe sample data through the same logger, audit writer, queue validator, event encryption, and backup encryption code used by the application. The protected test marker is supplied only to encryption boundaries and must not appear in the generated files.

Each run receives a new identifier and timestamp. The generated manifest is tied to the exact browser build and is written only after all five evidence files succeed.

## `writeEvidenceRecord`

Writes one evidence record only inside Vision's generated release-evidence folder.

## `encodeEncryptedColumn`

Converts an encrypted database column into a portable text encoding without decrypting it.

## `captureReleaseEvidence`

Runs all five real privacy boundaries, writes their generated evidence, and finishes with a fresh build-bound manifest.

## `append`

Receives the audit writer's validated serialized event for the generated audit record.

## `getDataKey`

Returns the temporary non-extractable encryption key used only for this local capture.
