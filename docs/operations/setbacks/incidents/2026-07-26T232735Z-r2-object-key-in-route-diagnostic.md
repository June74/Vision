# SB-20260726-232735-r2-object-key-in-route-diagnostic: R2 object key in route diagnostic

- **Status:** contained
- **First observed:** 2026-07-26T23:27:35Z
- **Last observed:** 2026-07-31T03:29:24.0599195Z
- **Phase/task:** Phase B provider navigation and live-acceptance closure Tasks 5-6
- **Environment:** Provider dashboard and read-only repository preflight
- **Version/commit:** `d7da15d`

## Symptom

A route-classification diagnostic redacted long hexadecimal segments but did
not redact a URL-encoded R2 object-key segment, so the opaque object key
appeared in captured tool output.

## Impact

One opaque backup object key was exposed in the tool transcript. No backup
body, database content, token, encryption key, account identifier, email, or
provider secret was exposed. No provider state changed.

## Reproduction conditions

Emit dashboard path segments while redacting only long hexadecimal identifiers
and the current page is an R2 object-details route.

## Safe evidence

The exposed value was limited to one opaque `.vision-backup` path segment.

## Attempts and outcomes

- The faulty diagnostic emitted the object-key segment once.
- Route output was stopped immediately.
- Remaining provider diagnostics are restricted to fixed booleans and counts;
  no path segments are returned.

## Cause classification

- **Confirmed cause:** The redaction rule covered account-like hexadecimal IDs
  but not URL-encoded R2 keys.
- **Hypotheses:** None.
- **Rejected hypotheses:** No object body or credential appeared.
- **Known exclusions:** Provider and repository state were unchanged.

## Correction and prevention

- **Correction:** Stop emitting provider route segments entirely.
- **Prevention:** Provider browser checks may return only predeclared fixed
  booleans and counts, even when path components appear non-secret.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Navigate through fixed labeled controls without
  returning route data.

## Verification and related work

Containment was immediate; the diagnostic itself was read-only.

The later source-preflight recurrence was also contained immediately. It
exposed only a fixed checked-in prefix literal, not an object key or provider
value, and the nonessential scout was retired.

## Recurrence history

- 2026-07-26T23:27:35Z: First observed and contained.
- 2026-07-31T03:29:24.0599195Z: A Task 5/6 source-symbol extraction returned
  one fixed backup-prefix literal. It was not a concrete object key, provider
  value, credential, or protected identifier. The scout stopped without
  mutation, network access, or further reads and was retired.
