# `src/jobs/rebuild-google-projection.ts`

When Google rejects an old sync token, this job downloads a fresh full listing without deleting Vision's own
categories, annotations, notes, or relationships.

## `rebuildGoogleProjection`

Creates encrypted staging, reads every full-list page with stable query rules, accepts a new sync token only on the
last page, and asks the synchronization repository to activate the complete generation atomically.

Missing Google events become recoverable tombstones. Reappearing events reuse their deterministic Vision identity.
Crashes and stale Queue workers cannot replace the active projection.

## `validateRequest`

Checks the owner, calendar, invalid checkpoint, job, and optional Queue claim.

## `validateProtectedPayloadSizes`

Retains the incremental sync path's 64 KiB protected-content limit.

## `utf8ByteLength`

Measures actual UTF-8 allocation instead of JavaScript character count.

## `canonicalJson`

Creates a stable comparison string for duplicate provider changes.

## `boundedText`

Recognizes a non-empty opaque string within its maximum length.
