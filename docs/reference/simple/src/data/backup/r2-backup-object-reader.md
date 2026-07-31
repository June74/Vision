# r2-backup-object-reader

Reads backup metadata and bodies without exposing write or delete operations. It rejects a body larger than
8,389,144 bytes before allocating storage, requires the stream to match its declared size exactly, and admits at
most 64 objects from one provider page.

## `createR2BackupObjectCatalogReader`
Creates the read-only catalog.
## `head`
Reads object facts.
## `get`
Checks the declared byte size first, then copies one exact-length bounded stream.
## `list`
Requests and validates a page of at most 64 objects.
## `readBoundedBody`
Copies a stream only after its declared size passes the fixed limit and requires the final byte count to match.
## `adapt`
Copies safe metadata.
## `exactMetadata`
Requires the exact four restore metadata fields as ordinary bounded strings.
## `bounded`
Rejects oversized strings.
