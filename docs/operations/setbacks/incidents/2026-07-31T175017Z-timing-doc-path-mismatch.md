# SB-20260731-175017-timing-doc-path-mismatch: Timing assignment named absent controller references

- **Status:** closed
- **First observed:** 2026-07-31T17:50:17.4991651Z
- **Last observed:** 2026-07-31T17:50:48.9808129Z
- **Phase/task:** Phase B Task 3 fourth-wave timing repair
- **Environment:** Local documentation inspection
- **Version/commit:** 69bf13c plus timing implementation edits

## Symptom

After the 46-minute controller repair and its 59 focused tests passed, a
read-only search failed because both documentation paths supplied by the parent
assignment were absent.

## Impact

The source and test repair is locally green, but its corresponding references
have not been updated. No provider state, environment, network, secret,
staging, or commit was touched by the failed read.

## Cause classification

- **Confirmed cause:** The delegated reference filenames were not validated
  against the repository before assignment.
- **Hypotheses:** The controller timing is documented under differently named
  Phase B workflow references.
- **Known exclusions:** The source and focused tests are not failing; 59 of 59
  focused tests passed.

## Correction and prevention

- **Correction:** Discover documentation paths by tracked filename/content,
  inspect the exact matches, and update only references that own the controller
  timing contract.
- **Prevention:** Resolve and verify reference paths before delegating bounded
  ownership.
- **Owner:** Codex.
- **Next diagnostic step:** List tracked documentation files matching preview
  acceptance controller terminology.

## Recurrence history

- 2026-07-31T17:50:17.4991651Z: Observed and contained after green focused
  source/test verification.
- 2026-07-31T17:50:48.9808129Z: Closed after tracked-file discovery found
  the references under singular `docs/reference/.../scripts/` paths.
