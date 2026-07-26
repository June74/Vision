# Phase B encrypted restore drill

**Status:** In progress  
**Source:** Private preview R2 bucket  
**Target:** Empty disposable Neon branch only  
**Live branch overwrite:** Forbidden

This document records only counts, booleans, timestamps, schema versions, and
checksums already defined as safe evidence. It never records object keys,
branch identifiers, credentials, database URLs, encryption keys, tokens,
emails, protected rows, or provider-controlled URLs.

## Approval and boundaries

| Action | Approval | Result |
|---|---|---|
| Create separate backup encryption key and store it as a Worker secret | Granted | Complete |
| Attach private preview R2 bucket and synchronization Queue | Granted | Complete |
| Deploy temporary backup schedule, create one verified encrypted object, restore the daily schedule | Granted | Complete |
| Apply migrations 0004 through 0009 to preview Neon | Granted | Complete |
| Create an empty disposable Neon branch, restore, verify, and permanently delete that branch | Granted | Pending |

The first temporary run was contained without an object after a read-only
schema comparison found the live preview database missing migrations 0004
through 0009. The normal daily cadence was redeployed and verified before the
migration approval is resolved.

## Local migration preflight

Before any live schema change, the exact numbered migration chain was exercised
against a disposable local PostgreSQL-compatible database:

- Migrations 0001 through 0003 established the current live starting shape.
- Migrations 0004 through 0009 applied inside one transaction.
- All 11 previously missing required tables and all nine migration-signature
  columns were present afterward.
- A deliberately failed transaction rolled back both migration-0004 tables.
- The expected `vision_app` privileges matched across 13 affected tables.
- The affected tables exposed zero grants to `PUBLIC`.

The reviewed bundle was then copied into the signed-in Neon SQL editor,
verified against the local source by exact character count and SHA-256, and
executed as one transaction. A post-apply read-only check found zero missing
required tables and zero missing signature columns.

## Drill checklist

- [x] Guarded temporary schedule deployment succeeds.
- [x] One backup for the current UTC date is present.
- [x] Stored object metadata uses format `vision-backup/v1` and key version 1.
- [ ] Stored ciphertext checksum matches the retrieved bytes.
- [ ] Authenticated decryption validates the manifest before any database write.
- [ ] Backup schema version and migration checksum are supported.
- [ ] Raw encrypted object contains no protected sentinel.
- [x] Empty disposable Neon branch is created.
- [ ] All 29 migration-9 tables restore.
- [ ] Row counts and plaintext checksum match the backup manifest.
- [ ] Foreign-key and graph-reference checks pass.
- [ ] Event listing works against restored state.
- [ ] Disposable branch is permanently deleted.
- [x] Normal daily schedule `5 6 * * *` is redeployed and verified.

## Result

Pending. The first live attempt correctly failed closed because the database
did not match the authenticated migration-9 backup contract. Phase B cannot be
declared complete until the schema is current and every checklist item has
fresh live evidence.
