# SB-20260726-220017-guessed-preview-workflow-filename: Guessed preview workflow filename

- **Status:** closed
- **First observed:** 2026-07-26T22:00:17Z
- **Last observed:** 2026-07-26T22:24:39.8262153Z
- **Phase/task:** Phase B temporary backup deployment
- **Environment:** Local PowerShell worktree
- **Version/commit:** `6a14659`

## Symptom

A read attempted `.github/workflows/deploy-preview.yml`, but the repository's
actual preview workflow is `.github/workflows/preview.yml`.

## Impact

No state changed. Workflow inspection was delayed by one command.

## Reproduction conditions

Assume a conventional workflow filename without listing the directory first.

## Safe evidence

The direct read returned a file-not-found error; bounded directory enumeration
then found the real filename.

## Attempts and outcomes

- The guessed direct read failed.
- Listing the workflow directory resolved the exact filename.

## Cause classification

- **Confirmed cause:** The filename was inferred instead of discovered.
- **Rejected hypotheses:** None.
- **Known exclusions:** No local or provider state changed.

## Correction and prevention

- **Correction:** Read `.github/workflows/preview.yml`.
- **Prevention:** Enumerate workflow filenames before opening one when its exact
  name has not been confirmed.
- **Owner:** Codex.

## Verification and related work

Closed after bounded directory enumeration identified the workflow.

## Recurrence history

- 2026-07-26T22:00:17Z: First occurrence.
- 2026-07-26T22:24:39.8262153Z: Recurred after enumerating
  `tests/unit/ci/workflows.test.ts` but opening the singular filename. No state
  changed; the enumerated path is used directly.
