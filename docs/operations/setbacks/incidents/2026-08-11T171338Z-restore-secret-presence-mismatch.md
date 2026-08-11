# SB-20260811-171338-restore-secret-presence-mismatch

- Incident ID: `SB-20260811-171338-restore-secret-presence-mismatch`
- First observed: `2026-08-11T17:13:38Z`
- Last observed: `2026-08-11T17:13:38Z`
- Status: `contained`
- Phase/task: Phase B encrypted restore-drill preparation
- Environment: Cloudflare `vision-preview` Worker secret inventory
- Version/commit: `a994775`

## Symptom

The owner reported saving the two temporary restore names, but a read-only
Wrangler inventory returned a valid list of ten existing secrets that did not
contain either `PREVIEW_RESTORE_DATABASE_URL` or `PREVIEW_RESTORE_TARGET_ID`.

The first verification parser also incorrectly assumed the JSON response was a
single object rather than an array, producing a false negative before the
response shape was corrected.

## Impact

No secret values were read or printed. No Worker, database, key, calendar,
deployment, or provider state changed. The restore candidate remains blocked.

## Cause classification

- **Confirmed:** the current `vision-preview` secret inventory does not expose
  either required restore name.
- **Possible owner-side causes:** the entries were added as plain variables,
  saved under another Worker/environment, or the dashboard save did not
  complete; this is not yet distinguished.
- **Operator mistake:** the first JSON parser assumed the wrong response shape.

## Correction and prevention

Inspect only the `vision-preview` Worker's **Secrets** list, not the Variables
list, and verify the names appear there before attempting restore. Parse
Wrangler's secret-list response as an array and report only allowlisted-name
booleans.

## Next step

Owner rechecks the exact Worker and Secrets section, then confirms only that the
two names are visible. A fresh read-only inventory must show both before any
restore deployment.

## Verification

The corrected probe parsed ten secret entries and found neither restore name;
no value or external mutation was involved.
