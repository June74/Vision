# `src/data/repositories/event-repository.ts`

This repository is the protected event-content gate. It accepts a normal event with readable content, encrypts that
content before storage, and returns readable content only after checking the owner and allowed privacy level.

## `save`

Checks the complete event, encrypts title, description, attendees, location, and meeting link with the event's exact
owner, node, domain, and field name, then makes one atomic storage call.

## `getPlanning`

Reads only time, identity, domain, privacy, and other planning-safe facts. It does not ask storage for encrypted
content.

## `get`

Reads the planning facts first, checks the requested owner and privacy permission, then loads the matching encrypted
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

## `validateReadAuthorization`

Checks the explicit owner and allowed privacy levels.

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
