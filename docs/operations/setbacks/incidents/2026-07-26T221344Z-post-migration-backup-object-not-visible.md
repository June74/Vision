# SB-20260726-221344-post-migration-backup-object-not-visible: Post-migration backup object not visible

- **Status:** closed
- **First observed:** 2026-07-26T22:13:44Z
- **Last observed:** 2026-07-26T23:14:06Z
- **Phase/task:** Phase B live encrypted backup acceptance
- **Environment:** Preview Worker and private preview R2 bucket
- **Version/commit:** `cab6d4d`

## Symptom

The guarded temporary one-minute recovery deployment succeeded, but no backup
object was visible in the private preview bucket after the first scheduler
interval.

## Impact

The restore drill was delayed until one verified encrypted object existed.

## Reproduction conditions

Deploy the one-minute recovery acceptance commit after the preview schema is
current, allow one scheduler interval, refresh the private bucket inventory,
and count only matching encrypted object links.

## Safe evidence

The guarded workflow passed all checks and deployment. The bucket inventory
contained zero matching backup-object links and zero table rows after refresh.
No object names or contents were captured.

## Attempts and outcomes

- The temporary deployment completed successfully.
- One scheduler interval elapsed.
- The R2 inventory was refreshed and remained at zero matching objects.
- After a second interval, return navigation reached the R2 area but the exact
  bucket-link click timed out before any object or setting action.
- The tested safe-tail workflow ran with deploy and verify disabled but its
  allowlisted capture step failed after the 85-second window; raw Wrangler
  stderr was suppressed by policy.
- The corrected multiline-safe capture returned only `category=none`,
  `cron=temporary_recovery`, and `outcome=ok`.
- Authenticated R2 inspection then found exactly one current-date
  `.vision-backup` object under the expected versioned date prefix.
- Safe object metadata checks confirmed format `vision-backup/v1`, key version
  1, the current UTC date, and a valid 43-character ciphertext digest.

## Cause classification

- **Confirmed cause:** The object existed, but the initial dashboard inspection
  remained at the wrong navigation level and therefore did not enumerate the
  dated object prefix.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The Worker was not blocked by the guarded deployment
  checks; the live schema had already passed the post-0009 signature.
- **Known exclusions:** No object key, backup body, secret, database URL, or
  protected row was captured.

## Correction and prevention

- **Correction:** Captured the allowlisted live scheduler outcome, navigated the
  exact versioned date prefix, and verified the safe object facts.
- **Prevention:** Require an object-count and authenticated-object verification
  gate after every temporary backup deployment.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Continue the disposable-branch restore drill.

## Verification and related work

Closed with one successful live scheduled invocation and one authenticated
current-date object whose safe metadata matches the backup contract.

## Recurrence history

- 2026-07-26T22:13:44Z: First observed after the authorized migration.
- 2026-07-26T23:14:06Z: Closed after safe-tail and authenticated R2
  verification proved the backup succeeded.
