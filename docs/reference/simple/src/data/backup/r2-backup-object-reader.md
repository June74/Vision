# r2-backup-object-reader

Reads backup metadata and bodies without exposing write or delete operations. It rejects a body larger than
8,389,144 bytes before allocating storage, requires the stream to match its declared size exactly, and admits at
most 64 objects from one provider page. Pagination is closed: the provider must return a real boolean marker, a
truncated page must contain one bounded nonempty cursor, and a terminal page must contain no cursor.

## `createR2BackupObjectCatalogReader`
Creates the read-only catalog.
## `head`
Reads object facts.
## `get`
Checks the declared byte size first, then copies one exact-length bounded stream.
## `list`
Requests and validates a page of at most 64 objects, rejecting every missing, malformed, or contradictory cursor
shape.
## `exactPaginationCursor`
Copies one cursor only from an exact truncated-page envelope and rejects cursor data on a terminal page.
## `readBoundedBody`
Copies a stream only after its declared size passes the fixed limit and requires the final byte count to match.
## `adapt`
Copies safe metadata.
## `exactMetadata`
Requires the exact four restore metadata fields as ordinary bounded strings.
## `bounded`
Rejects oversized strings.
