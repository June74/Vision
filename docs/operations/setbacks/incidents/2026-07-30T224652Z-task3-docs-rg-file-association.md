# SB-20260730-224652-task3-docs-rg-file-association: Task 3 docs audit hit the Windows rg file-association failure

- **Status:** closed
- **First observed:** 2026-07-30T22:46:52.192102Z
- **Last observed:** 2026-07-31T00:56:04.0632387Z
- **Phase/task:** Phase B live-acceptance closure Task 3 documentation verification
- **Environment:** Local Windows PowerShell docs audit
- **Version/commit:** Task 3 repair working tree after `38bed3e`

## Symptom

A read-only rg search could not start because rg.exe has no associated application in this PowerShell environment.

## Impact

The documentation lookup returned exit 1 and briefly paused the docs lane; no file, protected value, provider, or external state changed.

## Reproduction conditions

Invoke this environment's misassociated `rg.exe` during a read-only
documentation search.

## Safe evidence

The process failed to launch and returned only an application-association
category.

## Attempts and outcomes

- The `rg` lookup returned exit 1 before useful search output.
- The docs lane was redirected to PowerShell `Select-String`.

## Cause classification

- **Confirmed cause:** This Windows environment cannot launch its current
  `rg.exe` association.
- **Hypotheses:** None.
- **Rejected hypotheses:** The repository path and documentation files are not
  missing.
- **Known exclusions:** No file, protected value, provider, network, Git state,
  or external state changed.

## Correction and prevention

- **Correction:** Use bounded `Select-String` searches for the docs audit.
- **Prevention:** Do not invoke `rg` again in this environment unless its
  executable association is separately repaired.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The fallback command is available and the docs lane can proceed.

## Recurrence history

- 2026-07-30T22:46:52.192102Z: First observed.
- 2026-07-31T00:56:04.0632387Z: Recurred during the final bounded Task 3
  read-only trace when `rg.exe` again resolved through an unusable Windows
  association. The command did not run or change state; tracing resumed through
  the documented `Select-String` fallback.
