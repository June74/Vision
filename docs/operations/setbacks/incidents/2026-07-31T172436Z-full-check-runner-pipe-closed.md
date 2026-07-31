# SB-20260731-172436-full-check-runner-pipe-closed: Windows sandbox closed the complete-check command pipe

- **Status:** closed
- **First observed:** 2026-07-31T17:24:36.4360908Z
- **Last observed:** 2026-07-31T17:29:48.7208898Z
- **Phase/task:** Phase B Task 3 fourth-wave repair integration
- **Environment:** Local Windows sandbox complete repository verification
- **Version/commit:** 752b81f plus 24 unstaged implementation paths

## Symptom

The output-suppressed complete repository check did not return a test exit
category because the sandbox runner pipe closed before process exit.

## Impact

The complete gate result is unknown and the repair remains unaccepted. No raw
test output, provider, network, deployment, secret, or external mutation was
involved.

## Cause classification

- **Confirmed cause:** The orchestration pipe closed before the child process
  returned an exit code.
- **Hypotheses:** The child process may have outlived the sandbox transport or
  been terminated with it.
- **Known exclusions:** The 301-test integrated focused group, typecheck,
  documentation, security evidence, security scan, and build all passed first.

## Correction and prevention

- **Correction:** Confirm no orphan test process remains, then rerun through a
  bounded hidden process wrapper that stores local output and returns only the
  exit category.
- **Prevention:** Use the process wrapper for long output-suppressed Windows
  gates if direct runner pipes prove unstable.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Count only matching active local test processes.

## Recurrence history

- 2026-07-31T17:24:36.4360908Z: First observed and contained with an unknown
  gate result.
- 2026-07-31T17:26:07.3079653Z: A hidden `Start-Process` retry failed before
  test startup because the launcher encountered duplicate case-insensitive
  environment path keys. It created only two empty local diagnostic files; no
  test, provider, network, secret, or external action occurred. The next retry
  uses direct `cmd.exe` redirection without the PowerShell process launcher.
- 2026-07-31T17:29:48.7208898Z: Closed after direct file-redirection kept the
  runner stable, the complete repository `check` gate exited successfully, and
  both exact local diagnostic files were validated and removed.
