# r2-backup-object-reader

Reads backup metadata and bodies without exposing write or delete operations.

## `createR2BackupObjectCatalogReader`
Creates the read-only catalog.
## `head`
Reads object facts.
## `get`
Reads one object copy.
## `list`
Lists a bounded page.
## `adapt`
Copies safe metadata.
## `exactMetadata`
Requires the exact four restore metadata fields as ordinary bounded strings.
## `bounded`
Rejects oversized strings.
