# SB-20260727-201440-literalpath-wildcard-invalid: LiteralPath was combined with a wildcard

- **Status:** closed
- **First observed:** 2026-07-27T20:14:40Z
- **Last observed:** 2026-07-27T20:14:40Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Local Windows worktree
- **Version/commit:** `b9ec10c`

## Symptom

A secondary source search combined PowerShell `Select-String -LiteralPath` with
a wildcard and returned an illegal-path error.

## Impact

The primary restore-engine source inspection completed, but the secondary
adapter search did not run. No file or provider state changed.

## Cause classification

- **Confirmed cause:** `-LiteralPath` does not expand wildcards.
- **Known exclusions:** The error did not affect the live rollback or retained
  restore target.

## Correction and prevention

- **Correction:** Use `-Path` for glob expansion or enumerate exact files first.
- **Prevention:** Reserve `-LiteralPath` for exact paths only.

## Verification and related work

The primary source already established the relevant precondition and evidence
flow; target diagnosis proceeds through the retained database.
