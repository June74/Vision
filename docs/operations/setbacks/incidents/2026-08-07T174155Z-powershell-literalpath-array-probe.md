# SB-20260807-174155-powershell-literalpath-array-probe: Read-only schedule lookup passed an array to LiteralPath

- **Status:** closed
- **First observed:** 2026-08-07T17:41:55.101230Z
- **Last observed:** 2026-08-07T17:42:28.6976464Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A bounded schedule-definition probe passed multiple file paths to Select-String `-LiteralPath`, which accepts one literal path and failed before reading any files. A first correction also listed an optional configuration file that is absent, so that probe stopped before reading the confirmed files.

## Impact

No source or external state changed; the monitored controller remained safely paused at the baseline challenge.

## Reproduction conditions

Pass multiple existing files through `-Path`, or filter a candidate list with `Test-Path` before invoking `Select-String`.

## Safe evidence

The corrected scalar probe filtered confirmed existing configuration files, found three schedule-definition matches, and returned only counts. The controller remained paused and no external action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Array passed to `-LiteralPath`: PowerShell parameter error; no state change.
2. Optional missing file included in `-Path`: file-not-found error; no state change.
3. Existing-path filter plus `-Path`: completed with an allowlisted count.

## Cause classification

- **Confirmed cause:** `-LiteralPath` was given an array, and the first correction did not filter absent optional files.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The schedule definitions, controller, and provider were not exercised by either failed probe.
- **Known exclusions:** No provider, deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action occurred.

## Correction and prevention

- **Correction:** Filter existing paths first and use `-Path` for a path array; keep output scalar-only.
- **Prevention:** Use `Test-Path` before every optional-file read and never pass arrays to `-LiteralPath`.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful existing-path-filter probe; the monitored controller remains paused at the baseline challenge.

## Recurrence history

- 2026-08-07T17:41:55.101230Z: First observed.
- 2026-08-07T17:42:28.6976464Z: An optional missing path was rejected during
  the first correction; the existing-path filter and `-Path` correction then
  completed; incident closed.
