# SB-20260727-013323-select-string-match-name-missing: Select-String match had no Name property

- **Status:** closed
- **First observed:** 2026-07-27T01:33:23Z
- **Last observed:** 2026-07-27T01:33:23Z
- **Phase/task:** Phase B credential-log discovery
- **Environment:** Local PowerShell worktree
- **Version/commit:** `a433912`

## Symptom

A repository search tried to expand `Name` from `Select-String` match objects
and emitted property errors.

## Impact

The intended filenames were not summarized. No file, credential, or provider
state changed, and no secret value was captured.

## Cause classification

- **Confirmed cause:** `Select-String -List` returns match objects whose file
  location is exposed through `Path`, not `Name`.
- **Known exclusions:** The search was local and read-only.

## Correction and prevention

- **Correction:** Read the `Path` property and derive the filename only if
  needed.
- **Prevention:** Preserve PowerShell result types through pipelines instead of
  assuming they are file objects.

## Verification and related work

The correction is defined and no retry is required to create the requested
credential ledger.
