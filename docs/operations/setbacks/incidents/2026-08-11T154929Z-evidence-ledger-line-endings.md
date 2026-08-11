# SB-20260811-154929-evidence-ledger-line-endings

- Incident ID: `SB-20260811-154929-evidence-ledger-line-endings`
- First observed: `2026-08-11T15:49:29Z`
- Last observed: `2026-08-11T15:49:29Z`
- Status: `contained`
- Phase/task: Phase B evidence-ledger publication
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `b8ec5b7`

## Symptom

Applying two new evidence rows to the existing ledger mixed line endings,
which made the documentation commit appear to rewrite many unchanged lines.

## Impact

The two intended evidence rows were semantically correct. Only documentation
formatting was affected; no source, deployment, provider, database, secret,
key, calendar, or live runtime state changed.

## Cause classification

- **Confirmed cause:** the patch writer preserved existing carriage returns in
  some regions while writing new lines with LF endings.
- **Rejected hypotheses:** no evidence row or prior ledger content was lost.

## Correction and prevention

Normalize the ledger to its existing CRLF convention, verify the substantive
diff with whitespace ignored, and use the repository's established line-ending
convention for future evidence patches.

## Next step

Publish the normalized ledger together with this setback entry, then continue
the live synchronization and remaining Phase B gates.

## Verification

The working copy now contains only CRLF line endings, and the whitespace-
ignored diff contains exactly the two new evidence rows.
