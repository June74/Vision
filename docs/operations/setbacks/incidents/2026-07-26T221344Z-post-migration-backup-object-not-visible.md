# SB-20260726-221344-post-migration-backup-object-not-visible: Post-migration backup object not visible

- **Status:** investigating
- **First observed:** 2026-07-26T22:13:44Z
- **Last observed:** 2026-07-26T22:13:44Z
- **Phase/task:** Phase B live encrypted backup acceptance
- **Environment:** Preview Worker and private preview R2 bucket
- **Version/commit:** `cab6d4d`

## Symptom

The guarded temporary one-minute recovery deployment succeeded, but no backup
object was visible in the private preview bucket after the first scheduler
interval.

## Impact

The restore drill cannot start until one verified encrypted object exists. The
temporary schedule remains active while the latest safe scheduled-event stage
is diagnosed.

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

## Cause classification

- **Confirmed cause:** None established.
- **Hypotheses:** The scheduled invocation may have failed at a later backup
  stage, or the dashboard inventory may not yet have reflected the write.
- **Rejected hypotheses:** The Worker was not blocked by the guarded deployment
  checks; the live schema had already passed the post-0009 signature.
- **Known exclusions:** No object key, backup body, secret, database URL, or
  protected row was captured.

## Correction and prevention

- **Correction:** Pending the latest safe scheduled-event outcome.
- **Prevention:** Require an object-count and authenticated-object verification
  gate after every temporary backup deployment.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Read only the latest safe scheduled action/category
  from the preview Worker, then diagnose that exact stage.

## Verification and related work

Pending.

## Recurrence history

- 2026-07-26T22:13:44Z: First observed after the authorized migration.
