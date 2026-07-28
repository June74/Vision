# `src/domain/operations/phase-b-privilege-manifest.ts`

Defines the strict migration-9 PostgreSQL privilege contract. The exported
production value is deliberately `undefined` until the controller provides
live-attested schema ownership and all 29 table expectations.

## `isCompletePhaseBPrivilegeManifest`

Snapshots a hostile candidate and validates exact keys, `vision_app`, nonempty
schema and owner names, canonical privilege arrays, grant-option subsets, and
the authoritative `BACKUP_TABLES` order.

## `comparePhaseBPrivilegeFacts`

Performs an exact field-by-field comparison of two admitted manifests,
including owners, effective privileges, and grant options.

## `isPrivilegeList`

Admits only duplicate-free privilege arrays in the supported canonical order.

## `isSubset`

Confirms that each grant-option entry exists in the corresponding effective
privilege list.

## `sameStrings`

Requires equal lengths and equal values at every index.

## `snapshotPlainRecord`

Uses property descriptors to copy only enumerable data fields from plain or
null-prototype objects without invoking accessors.

## `hasExactKeys`

Checks key-count equality and ownership of every allowlisted string key.

## `isNonemptyText`

Requires a string containing at least one character.
