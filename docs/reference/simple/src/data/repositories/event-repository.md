# `src/data/repositories/event-repository.ts`

This repository is the protected event-content gate. Its production Drizzle adapter executes atomic PostgreSQL writes.
The repository accepts readable event content, encrypts it before storage, and returns it only for the authenticated
owner after a server policy issues a privately marked privacy decision.

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

Checks the row returned by atomic storage still has the requested owner and stable identity and is not older.

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

Uses one PostgreSQL statement to insert or update only a strictly newer provider version and returns the row the
database kept.

## `selectPlanningEvent`

Queries only planning-safe event and node columns for one owner.

## `selectProtectedEvent`

Queries encrypted columns only for the already-authorized owner, node version, and provider version.

## `assertIdempotentReplay`

Checks owner/privacy again, decrypts an equal-version row, and rejects it unless every fact exactly matches.

## `createEventRepository`

Builds the owner-scoped repository with the production Drizzle store and server authorization policy.

## `databaseRowToPlanningEvent`

Turns one PostgreSQL planning projection into a validated Vision event.

## `databaseRowToStoredEvent`

Turns one PostgreSQL protected projection into the encrypted row contract.

## `decryptStoredEvent`

Decrypts a stored row only after its owner/privacy decision.

## `storedRowToPlanningEvent`

Removes all encrypted persistence columns from a stored row.

## `plaintextEventsEqual`

Compares two normalized complete events for an exact retry.
