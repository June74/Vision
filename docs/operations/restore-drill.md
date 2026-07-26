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
| Deploy temporary backup schedule, create one verified encrypted object, restore the daily schedule | Granted | In progress |
| Create an empty disposable Neon branch, restore, verify, and permanently delete that branch | Requested | Pending |

The first temporary run was contained without an object after a read-only
schema comparison found the live preview database missing migrations 0004
through 0009. The normal daily cadence was redeployed and verified before the
migration approval is resolved.

## Drill checklist

- [ ] Guarded temporary schedule deployment succeeds.
- [ ] One backup for the current UTC date is present.
- [ ] Stored object metadata uses format `vision-backup/v1` and key version 1.
- [ ] Stored ciphertext checksum matches the retrieved bytes.
- [ ] Authenticated decryption validates the manifest before any database write.
- [ ] Backup schema version and migration checksum are supported.
- [ ] Raw encrypted object contains no protected sentinel.
- [ ] Empty disposable Neon branch is created.
- [ ] All 29 migration-9 tables restore.
- [ ] Row counts and plaintext checksum match the backup manifest.
- [ ] Foreign-key and graph-reference checks pass.
- [ ] Event listing works against restored state.
- [ ] Disposable branch is permanently deleted.
- [ ] Normal daily schedule `5 6 * * *` is redeployed and verified.

## Result

Pending. The first live attempt correctly failed closed because the database
did not match the authenticated migration-9 backup contract. Phase B cannot be
declared complete until the schema is current and every checklist item has
fresh live evidence.
