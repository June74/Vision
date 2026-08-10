# SB-20260806-225654-powershell-containment-probe-quoting: Read-only active-state containment probe had a PowerShell parser error

- **Status:** closed
- **First observed:** 2026-08-06T22:56:54.233164Z
- **Last observed:** 2026-08-06T22:58:14.000000Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A diagnostic PowerShell expression combining path containment checks had unbalanced quoting and stopped before reading the active-state result.

## Impact

No application, provider, deployment, database, calendar, credential, secret, or key state changed; the guarded deployment did not start.

## Reproduction conditions

The first active-state probe combined nested path expressions and a string literal with an unbalanced quote, so PowerShell stopped during parsing before the read-only result was evaluated.

## Safe evidence

The corrected probe parsed the existing state, confirmed the prior process was not alive, confirmed both log paths were contained under the SDD directory, and confirmed no XDG override was configured. No provider action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Combined containment expression: parser failure before evaluation; no state change.
2. Split path calculations into bounded variables and reran: read-only probe completed with safe booleans.

## Cause classification

- **Confirmed cause:** PowerShell quoting in the diagnostic expression was malformed.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The active state was not running; the failure was not a controller or provider failure.
- **Known exclusions:** No deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action was attempted.

## Correction and prevention

- **Correction:** Split containment checks into simple statements and rerun them before any launch.
- **Prevention:** Avoid nested quote-heavy expressions in safety probes; prefer small typed variables with allowlisted Boolean output.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the corrected read-only probe: process not alive, log paths contained, and XDG override absent.

## Recurrence history

- 2026-08-06T22:56:54.233164Z: First observed.
