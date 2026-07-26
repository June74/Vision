# Release evidence capture

`scripts/capture-release-evidence.ts` is the producer half of the Phase B release-security contract. `security:scan` executes it after the client build and before the scanner, so static or copied fixture metadata cannot satisfy the release gate.

The producer invokes `logEvent`, `AuditWriter.write`, `parseCalendarSyncMessage`, `prepareStoredEventRow`, and `encryptBackupEnvelope`. Protected sentinel content is admitted only to the event-field and backup encryption inputs. The resulting database envelopes and R2 object remain encrypted.

Every record carries one random version-4 run identifier, canonical capture time, current `dist/client` digest, exact production source boundary, and surface name. The manifest repeats the run identity and digest and is written last, preventing a partially completed capture from being admitted.

## `writeEvidenceRecord`

Resolves the requested path beneath `dist/release-evidence`, rejects traversal or unsafe characters, creates its parent, and writes one JSON-lines envelope with shared capture provenance.

## `encodeEncryptedColumn`

Encodes an already encrypted `Uint8Array` database value as canonical base64url. It does not accept or decrypt plaintext.

## `captureReleaseEvidence`

Computes the client digest, constructs shared capture context, executes all five production privacy boundaries, writes their records, and writes the exact manifest last. Any rejected boundary or filesystem failure prevents a valid complete evidence set.

## `append`

Implements the injected `AuditEventSink` in memory so the output must first pass `AuditWriter.write` and can then be wrapped with capture provenance.

## `getDataKey`

Implements the narrow `KeyProvider` contract with one non-extractable AES-256-GCM key and version 1. The raw key is never exported or persisted.
