# r2-backup-object-reader

Adapts `Pick<R2Bucket, "head" | "get" | "list">` to `BackupObjectCatalogReader`.

## `createR2BackupObjectCatalogReader`
Returns exactly `head`, `get`, and `list`.
## `head`
Copies bounded head metadata.
## `get`
Requires a positive safe-integer provider size no greater than 8,389,144 bytes before allocating the destination,
streams into that fixed allocation, and rejects early EOF or any chunk that would exceed the declared size. It does
not use the provider's unbounded whole-body allocation helper.
## `list`
Requests no more than 64 entries, rejects a provider response above that limit before mapping it, and exposes only
bounded copied metadata without mutation capabilities. It validates the pagination envelope before mapping object
metadata: `truncated` must be an own enumerable boolean; `true` requires exactly one own enumerable bounded,
nonempty string cursor; and `false` requires the cursor property to be absent, including from the prototype chain.
## `exactPaginationCursor`
Reads pagination fields through own property descriptors without invoking accessors. It rejects missing or
wrong-type truncation markers and missing, empty, wrong-type, overlong, inherited, accessor-backed, or contradictory
cursors before the restore selector receives the page.
## `readBoundedBody`
Validates the provider size before the sole fixed allocation, consumes `ReadableStream<Uint8Array>` chunks without
an unbounded whole-body helper, cancels on a stream failure, and requires exact declared-versus-observed byte parity.
## `adapt`
Bounds keys, etags, and custom metadata.
## `exactMetadata`
Reconstructs only the exact restore metadata vocabulary without accessors,
aliases, extra keys, or invalid format/date/digest/version values.
## `bounded`
Enforces string limits.
