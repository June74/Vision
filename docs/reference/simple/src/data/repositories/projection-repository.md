# `src/data/repositories/projection-repository.ts`

This repository keeps a Google full-calendar rebuild in a separate encrypted staging area until every page is present.
Only planning-safe event facts are queryable. Titles, descriptions, attendees, locations, and links remain inside an
authenticated ciphertext envelope.

## `createProjectionRepository`

Creates an owner-bound repository. A caller cannot read or stage another owner's generation.

## `beginRebuild`

Creates one checkpoint-bound generation without changing the active event projection.

## `stageChanges`

Stores each unique provider identity in page order and encrypts its protected payload.

## `markReady`

Seals a generation after the final provider page has supplied the only accepted new sync token.

## `loadStagedChanges`

Authenticates, decrypts, and revalidates the closed provider-change contract before activation.

## `abandon`

Marks a failed pre-activation generation safe for later cleanup.

## `assertOwner`

Rejects access through a repository created for a different owner.

## `validateBegin`

Checks bounded generation, calendar, job, version, claim, and timestamp metadata.

## `digestIdentity`

Hashes the provider/calendar/event tuple into a fixed-size stage key.

## `stageContext`

Binds stage encryption to the owner, generation, and identity digest.

## `encodeEnvelope`

Serializes a validated cipher envelope into database bytes.

## `decodeEnvelope`

Parses a stored cipher envelope after strict UTF-8 decoding.

## `readJsonObject`

Accepts only a JSON object for planning-safe staged facts.

## `readDigest`

Validates a canonical SHA-256 base64url digest.

## `readPositiveInteger`

Validates positive key-version metadata returned by PostgreSQL.

## `readBytes`

Copies PGlite bytes or decodes canonical PostgreSQL `bytea`.

## `requireBoundedText`

Rejects empty or oversized opaque metadata.
