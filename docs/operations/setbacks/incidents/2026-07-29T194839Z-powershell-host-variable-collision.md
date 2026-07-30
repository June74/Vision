# SB-20260729-194839-powershell-host-variable-collision: Ref lookup reused a reserved PowerShell variable

- **Status:** closed
- **First observed:** 2026-07-29T19:48:39Z
- **Last observed:** 2026-07-30T18:02:55.9410304Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
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

## Recurrence history

- 2026-07-30T00:58:57.9225467Z: The final wave-3 audit reused PowerShell's
  automatic `$Matches` variable as a numeric privacy counter. Later regex
  checks replaced it with the automatic match hashtable, so JSON serialization
  failed after the read-only checks. No match content, private value, file
  change, or external action occurred. The retry uses a task-specific counter.
- 2026-07-30T00:59:58.8828765Z: The retry used a task-specific counter and
  returned the complete JSON audit with zero strict sensitive-value matches,
  closing the recurrence.
- 2026-07-30T18:02:55.9410304Z: A read-only plan code-block parser reused
  `$error`, which collides case-insensitively with PowerShell's read-only
  automatic `$Error` variable. The helper stopped after its first parsed block;
  no plan, repository, provider, or private state changed. The retry uses
  `$parseIssue`.

## Verification and related work

Closure of action pinning still requires four successful official-ref results
and workflow tests asserting the immutable references.

The corrected plan helper used task-specific parser variable names and parsed
all 29 PowerShell code blocks with zero syntax errors.
