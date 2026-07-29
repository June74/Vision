# SB-20260729-235557-pnpm-powershell-launcher-policy: PowerShell selected the unsigned pnpm script launcher

- **Status:** closed
- **First observed:** 2026-07-29T23:55:57Z
- **Last observed:** 2026-07-29T23:55:57Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 2
- **Environment:** Local Phase B worktree on Windows PowerShell
- **Version/commit:** Post-implementation reporting after `8bf5d4a`

## Symptom

The documentation check invoked `pnpm`, which PowerShell resolved to the
unsigned `pnpm.ps1` launcher. The local execution policy rejected that script
before the repository command started.

## Impact

The first documentation-check attempt did not run. It made no repository,
provider, deployment, database, or calendar change.

## Cause classification

- **Confirmed cause:** PowerShell selected the script launcher instead of the
  native Windows command launcher.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** This was not a documentation-check assertion
  failure and did not originate in project code.
- **Known exclusions:** No sandbox escalation or external service was involved.

## Correction and prevention

- **Correction:** Invoke `pnpm.cmd` explicitly for PowerShell verification
  commands on this machine.
- **Prevention:** Prefer the native `.cmd` package-manager launcher in future
  Windows PowerShell automation where script signing is enforced.
- **Owner:** Codex and project owner.

## Verification and related work

The same documentation check is rerun through `pnpm.cmd`; its exit status is
the authoritative result.

## Recurrence history

- 2026-07-29T23:55:57Z: First observed and corrected.
