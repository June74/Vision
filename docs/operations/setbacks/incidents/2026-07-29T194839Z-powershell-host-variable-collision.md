# SB-20260729-194839-powershell-host-variable-collision: Ref lookup reused a reserved PowerShell variable

- **Status:** closed
- **First observed:** 2026-07-29T19:48:39Z
- **Last observed:** 2026-07-29T19:48:39Z
- **Phase/task:** Phase B consolidated final-fix action pinning
- **Environment:** Local Phase B worktree
- **Version/commit:** Working changes based on `e3c1272`

## Symptom

The read-only official-ref lookup attempted to assign to PowerShell's reserved
`$Host` variable. Assignment failed, and Git then received the built-in host
object instead of the intended remote domain.

## Impact

The ref lookup failed before obtaining a reviewed SHA. No network mutation,
repository mutation, or provider action occurred.

## Cause classification

- **Confirmed cause:** A common reserved PowerShell variable name was reused.
- **Hypotheses:** None.
- **Rejected hypotheses:** Missing action refs.
- **Known exclusions:** No remote write command was used.

## Correction and prevention

- **Correction:** Retry with a task-specific variable name and fail on the
  first ref-read error.
- **Prevention:** Do not reuse built-in or common PowerShell variable names.
- **Owner:** Codex.
- **Next diagnostic step:** Resolve all four tags independently from their
  official repositories.

## Verification and related work

Closure of action pinning still requires four successful official-ref results
and workflow tests asserting the immutable references.
