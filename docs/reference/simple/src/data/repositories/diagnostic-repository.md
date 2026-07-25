# Diagnostic repository

This owner-bound repository reads only safe operational counters and decrypts event titles only for the authenticated user. Category corrections stay inside Vision.

## `readFoundationFacts`

Reads current sync, queue, channel, authorization, and AI-spend facts.

## `listEvents`

Lists at most 200 active events and decrypts only their display titles.

## `correctCategory`

Records a user-confirmed Vision category and removes weaker model confidence.

## `decodeEvent`

Checks one database row and decrypts its title.

## `createDiagnosticRepository`

Creates a repository fixed to one authenticated owner.

## `decodeEnum`

Accepts only a named closed database value.

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
