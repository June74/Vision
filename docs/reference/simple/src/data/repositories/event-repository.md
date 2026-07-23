# `src/data/repositories/event-repository.ts`

This repository is the protected event-content gate. Its production Drizzle adapter executes atomic PostgreSQL writes.
The repository accepts readable event content, encrypts it before storage, and returns it only for the authenticated
owner only when a verified server access capability authorizes the privacy snapshot.

## `save`

Checks the complete event and owner, encrypts title, description, attendees, location, and meeting link with the
event's exact owner, node, domain, and field name, then makes one atomic storage call. Equal versions must be exact
replays; conflicting content is rejected.

## `getPlanning`

Reads only time, identity, domain, privacy, and other planning-safe facts for the repository's authenticated owner. It
does not ask storage for encrypted content.

## `get`

Reads the planning facts first, obtains and verifies a server policy decision, then loads the matching node/provider
version and decrypts it. A concurrent change cancels the read.

## `validatePlaintextEvent`

Accepts only the exact plain event shape and protected string values.

## `toPlanningEvent`

Removes protected content from a validated event.

## `toStoredEventRow`

Builds the binary encrypted row and confirms all represented fields use one key version.

## `encodeEnvelope`

Turns an authenticated envelope into binary JSON for database storage.

## `decodeEnvelope`

Turns stored binary JSON back into a validated envelope after authorization.

## `toEncryptedProtectedFields`

Builds the protected-field map and checks its key metadata.

## `validateAuthoritativeSave`

Checks exact owner, stable identity, node version, domain, domain state, and privacy. A mismatch has one typed safe
error.

## `matchesAuthorizedSnapshot`

Confirms the protected row is the same owner, version, domain, and privacy snapshot that was authorized.

## `validateOpaqueLookup`

Requires non-empty node and owner IDs.

## `isNullableString`

Recognizes a string or an absent protected value.

## `validateAttendees`

Accepts only a normal dense array of strings.

## `parseAttendees`

Rechecks the attendee array recovered from authenticated ciphertext.

## `saveAtomically`

Requires the exact node snapshot in the write statement and returns only planning-safe facts. An empty conflict result
causes a fresh planning-only winner query. The eligible node row is locked until this statement commits, so a node
privacy/domain/version update cannot interleave with the event write.

The lock lasts only for this transaction. A later node reclassification is still possible and must coordinate
re-encryption of its protected events before changing cryptographic or privacy facts.

## `selectSaveWinner`

Reads only planning-safe winner facts in a fresh database snapshot after an empty conflict result.

## `selectPlanningEvent`

Queries only planning-safe event and node columns for one owner.

## `selectProtectedEvent`

Queries encrypted columns only for the already-authorized owner, node version, and provider version.

## `assertIdempotentReplay`

Checks owner/privacy again, decrypts an equal-version row, and rejects it unless every fact exactly matches.

## `createEventRepository`

Builds the owner-scoped repository only from an opaque verified server access capability.

## `databaseRowToPlanningEvent`

Strictly decodes raw Neon cells into a validated Vision event.

## `databaseRowToStoredEvent`

Strictly decodes raw Neon cells, including `bytea`, into the encrypted row contract.

## `decryptStoredEvent`

Decrypts a stored row only after its owner/privacy decision.

## `storedRowToPlanningEvent`

Removes all encrypted persistence columns from a stored row.

## `plaintextEventsEqual`

Compares two normalized complete events for an exact retry.

## `decodeDatabaseString`

Accepts one required raw PostgreSQL text cell without coercion.

## `decodeDatabaseNullableString`

Accepts either a raw PostgreSQL text cell or database null.

## `decodeDatabaseBoolean`

Accepts Neon raw `t`/`f` or an already-decoded test-driver boolean.

## `decodeDatabasePositiveInteger`

Accepts a canonical positive safe decimal integer.

## `decodeDatabaseTimestamp`

Requires a timestamp with an explicit UTC offset and returns canonical ISO text.

## `decodeDatabaseBytea`

Decodes bounded canonical lowercase PostgreSQL `\x` hexadecimal text or validated driver bytes.

## `decodeDatabaseNullableBytea`

Accepts either a protected binary cell or database null.
