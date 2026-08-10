# SB-20260726-204229-background-process-path-collision: Background process launch hit a Path-key collision

- **Status:** closed
- **First observed:** 2026-07-26T20:42:29.7633250Z
- **Last observed:** 2026-08-03T00:36:28.2471845Z
- **Phase/task:** Phase B clean-room verification
- **Environment:** Local Windows PowerShell
- **Version/commit:** `9f5a0d5`

## Symptom

PowerShell rejected a hidden background process launch because the inherited
environment exposed case-variant `Path` keys that collide on Windows.

## Impact

The background quality gate did not start. Empty temporary output files may
have been created, but no repository or provider state changed.

## Reproduction conditions

Use `Start-Process` with the inherited environment in this PowerShell session.

## Safe evidence

The launcher returned a duplicate-dictionary-key category before providing a
process identifier.

## Attempts and outcomes

- The inherited-environment launch failed before process creation.
- The launcher's clean-environment mode failed with the same collision.
- The next attempt bypasses PowerShell's environment-copying launcher.

## Cause classification

- **Confirmed cause:** Case-variant environment keys collided while
  `Start-Process` constructed the child environment on Windows.
- **Hypotheses:** None.
- **Rejected hypotheses:** A clean child environment did not avoid the
  PowerShell launcher collision. The repository command itself did not fail.
- **Known exclusions:** No test process started and no provider was contacted.

## Correction and prevention

- **Correction:** Use the lower-level Windows process API, which does not copy
  the environment through PowerShell's conflicting dictionary.
- **Prevention:** Avoid `Start-Process` in this session.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Confirm the clean-environment launch starts and
  returns an exit status.

## Verification and related work

The lower-level process API returned a valid process identifier and the
background quality gate ran to completion.

## Recurrence history

- 2026-07-26T20:42:29.7633250Z: First observed.
- 2026-07-26T20:43:11.8377617Z: Recurred with `UseNewEnvironment`; no child
  process started, disproving the proposed workaround.
- 2026-07-26T20:46:22.9385791Z: Closed after the lower-level process API
  bypassed the PowerShell launcher and returned a complete command result.
- 2026-07-26T23:07:19Z: Recurred when `Start-Process` was mistakenly reused
  for the complete release-gate reproduction. No child process started; the
  retry uses the documented lower-level Windows process API.
- 2026-07-30T18:56:43.8315896Z: Recurred when the Phase B closure baseline
  mistakenly reused `Start-Process` for the unit suite. The duplicate `Path`
  category occurred before process creation, the returned process identifier
  was null, and no test or provider action started. The retry uses the
  resumable execution tool instead of PowerShell's environment-copying
  launcher.
- 2026-08-03T00:36:28.2471845Z: Recurred when corrected-redeploy diagnostics
  mistakenly used `Start-Process` to capture Wrangler output. The duplicate
  `Path` category occurred before process creation and temporary files were
  removed. A direct, fully captured native invocation then returned the safe
  classification without exposing output, closing the recurrence.
