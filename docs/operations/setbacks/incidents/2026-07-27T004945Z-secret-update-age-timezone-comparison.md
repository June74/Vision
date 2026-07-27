# SB-20260727-004945-secret-update-age-timezone-comparison: Secret update age used inconsistent time zones

- **Status:** closed
- **First observed:** 2026-07-27T00:49:45Z
- **Last observed:** 2026-07-27T00:49:45Z
- **Phase/task:** Phase B preview Cloudflare account correction
- **Environment:** GitHub CLI JSON and local PowerShell
- **Version/commit:** `22c5dc0`

## Symptom

The first metadata check reported that the secret was not recently updated
because it subtracted timestamps without normalizing the provider timestamp to
UTC.

## Impact

Verification was briefly inconclusive. No provider or repository state changed.

## Reproduction conditions

Subtract a parsed provider timestamp from UTC now without explicitly converting
the parsed value to UTC.

## Safe evidence

The corrected comparison reported the update in every safe recent-age bucket.
No timestamp value or secret content was printed.

## Attempts and outcomes

- The unnormalized comparison returned false.
- The UTC-normalized comparison returned true for under five minutes.

## Cause classification

- **Confirmed cause:** Timestamp kinds were compared inconsistently.
- **Hypotheses:** None.
- **Rejected hypotheses:** The named secret was not stale.
- **Known exclusions:** No secret value was available from GitHub metadata.

## Correction and prevention

- **Correction:** Convert the provider timestamp to UTC before subtraction.
- **Prevention:** Normalize both operands before any provider-age comparison.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected coarse age check showed the named secret was updated within five
minutes.

## Recurrence history

- 2026-07-27T00:49:45Z: First observed and closed.
