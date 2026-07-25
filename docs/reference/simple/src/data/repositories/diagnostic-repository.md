# Diagnostic repository

This owner-bound repository reads only safe operational counters and decrypts event titles only after the server's verified authorization check. Category corrections stay inside Vision and move encrypted event data safely with the category.

## `readFoundationFacts`

Reads current sync, queue, channel, authorization, and AI-spend facts.

## `listEvents`

Lists at most 200 active events, authorizes each planning row, and decrypts only its display title.

## `correctCategory`

Re-encrypts the exact event and retained provider payload under the new category, then atomically records user-confirmed Vision authority.

## `authorizePlanningEvent`

Checks the existing server-issued capability before any protected event lookup.

## `readAuthorizedDiagnosticEvent`

Reads and decrypts one title only while its authorized planning snapshot is unchanged.

## `readCorrectionPlanningSnapshot`

Reads non-sensitive event and category facts before correction authorization.

## `readCorrectionProtectedSnapshot`

Reads all domain-bound encrypted event values for the exact authorized snapshot.

## `decryptCorrectionSnapshot`

Decrypts the old-category event fields and retained provider payload.

## `prepareCorrection`

Encrypts those values under the target category before any database write.

## `applyCorrection`

Atomically checks the old bytes, writes the new bytes, and records category authority.

## `decodePlanningEvent`

Checks one planning-only event row.

## `decodeCorrectionPlanningSnapshot`

Checks the planning and category-assignment snapshot used by a correction.

## `decodeCorrectionProtectedSnapshot`

Copies and checks the protected rows used by correction comparison.

## `decodeCorrectionEventEnvelopes`

Parses all encrypted event fields and verifies their key metadata.

## `decodeCheckedEnvelope`

Parses one encrypted envelope and checks its key version.

## `requireOneEnvelopeVersion`

Requires one key version across all represented event fields.

## `isIdempotentCorrection`

Recognizes an already-persisted explicit category so a retry does not rewrite it.

## `correctionFromPlanning`

Returns the existing safe category result for an idempotent retry.

## `decodeCorrectionResult`

Checks the safe result of the atomic category update.

## `encodeEnvelope`

Serializes an optional encrypted envelope for database storage.

## `encodeRequiredEnvelope`

Serializes an encrypted envelope that is not allowed to be absent.

## `nullableByteaSql`

Builds a parameterized encrypted database value while preserving null.

## `requiredByteaSql`

Builds a required parameterized encrypted database value.

## `bytesToHex`

Converts bounded encrypted bytes for safe parameterized SQL transport.

## `createDiagnosticRepository`

Creates a repository fixed to one verified server-issued owner capability.

## `decodeEnum`

Accepts only a named closed database value.

## `decodeBoolean`

Reads a true or false database value without loose coercion.

## `decodeText`

Reads bounded database text.

## `decodeDate`

Reads a real timezone-aware timestamp.

## `decodeNullableDate`

Reads an optional timestamp.

## `decodeNonnegativeInteger`

Reads a safe count or cent value.

## `decodePositiveInteger`

Reads a positive version or key number.

## `decodeBytea`

Copies a bounded encrypted database value.

## `assertDate`

Checks a caller-supplied timestamp.

## `validateEventId`

Checks the opaque event identifier before a query.
