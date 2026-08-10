# SB-20260807-174515-powershell-exists-getitem-poll: Post-baseline poll evaluated Get-Item before an existence guard

- **Status:** closed
- **First observed:** 2026-08-07T17:45:15.502909Z
- **Last observed:** 2026-08-07T17:57:36.7808560Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A read-only PowerShell poll combined Test-Path and Get-Item without explicit parentheses, so it attempted to read an absent candidate challenge file and stopped before polling.

## Impact

No controller, deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action changed; the already validated baseline evidence remained in place.

## Reproduction conditions

Guard every optional file read with an explicit `Test-Path` branch before calling `Get-Item`.

## Safe evidence

The corrected poll used a dedicated `Test-NewChallenge` function, waited safely, and captured the final pre-dispatch timeout result with bounded stdout and empty stderr. Do not paste private or secret values.

## Attempts and outcomes

1. Unguarded combined expression: file-not-found error; no state change.
2. Explicit existence guard: poll completed and returned safe status.

## Cause classification

- **Confirmed cause:** PowerShell evaluated the `Get-Item` branch before the intended existence guard.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The controller and challenge files were not the cause; the controller remained safe and later produced the documented timeout category.
- **Known exclusions:** No deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action.

## Correction and prevention

- **Correction:** Use a separate guard function that returns false before any `Get-Item` call for absent paths.
- **Prevention:** Avoid relying on operator precedence for filesystem existence checks.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful guarded poll and the final allowlisted controller parse.

## Recurrence history

- 2026-08-07T17:45:15.502909Z: First observed.
- 2026-08-07T17:57:36.7808560Z: Guarded poll completed; incident closed.
