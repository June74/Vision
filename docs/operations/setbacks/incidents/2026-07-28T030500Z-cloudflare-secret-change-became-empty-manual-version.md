# SB-20260728-030500-cloudflare-secret-change-became-empty-manual-version: Secret change became an empty manual version

- **Status:** contained
- **First observed:** 2026-07-28T03:05:00Z
- **Last observed:** 2026-07-28T03:20:00Z
- **Phase/task:** Preview database role probe Task 2 Step 2
- **Environment:** Signed-in Cloudflare preview Worker controls
- **Version/commit:** Probe candidate `e2d85ce`

## Symptom

Two authorized dashboard flows showed a safe success signal, but fresh and
delayed Worker inventories both showed zero exact
`PREVIEW_RESTORE_DATABASE_URL` rows and zero matching Secret rows.

## Impact

The temporary database secret was not accepted, so the role-probe observer and
deployment did not start. Two new Worker versions were created without the
intended secret change. The active normal runtime remained available; no
database, R2, restore, or encryption-key action occurred.

## Reproduction conditions and safe evidence

- Open the preview Worker's Variables and Secrets editor.
- Enter the exact temporary secret and use the attempted multi-row flow.
- A success signal appears, but the resulting version is classified as a
  generic manual dashboard version rather than an Add-secret version.
- Fresh and bounded delayed inventories both show exact secret count zero.
- An older successful secret change is classified as Add-secret, providing a
  working comparison without exposing its value or provider identifier.

## Cause classification

- **Confirmed cause:** The two attempted flows created generic manual versions
  with no persisted secret-binding change.
- **Hypothesis:** Clicking the optional `Add variable` control left an extra
  blank row, causing Cloudflare to deploy an empty configuration change instead
  of the intended single secret.
- **Rejected hypotheses:** Immediate stale rendering and short propagation
  delay; fresh and delayed inventories agreed. A duplicated Deploy click; the
  corrected attempt used one Deploy click and had the same result.
- **Known exclusions:** No secret value, database URL, account identifier,
  provider identifier, token, key, or private row was recorded.

## Attempts and outcomes

1. The first authorized flow showed success but the exact secret remained
   absent.
2. A corrected single-Deploy retry showed success but the exact secret remained
   absent.
3. Read-only version-history comparison showed both attempts were generic
   manual versions, not Add-secret versions.
4. A canceled dummy form proved `Add variable` creates a second blank row while
   leaving Deploy enabled; the dummy form was never deployed.

## Correction and prevention

- **Correction:** Run one final minimal hypothesis test with exactly one Secret
  row, no `Add variable` click, and one Deploy click. Require an Add-secret
  version classification and exactly one fresh Secret row before proceeding.
- **Prevention:** For one Worker secret, use the documented one-row flow and
  treat `Add variable` only as an add-more control. Verify both deployment
  classification and fresh name/type inventory.
- **Owner:** Codex.
- **Next diagnostic step:** Complete the one-row test once; a failure stops
  further dashboard retries and triggers architecture reconsideration.

## Verification and related work

The live report at
`.superpowers/sdd/preview-role-probe-task-2-report.md` preserves the fixed safe
counts and external-state exclusions. No provider identifier or secret value
is copied into this incident.
