# SB-20260807-175133-powershell-status-reconcile-brace: Status reconciliation probe had an unbalanced PowerShell block

- **Status:** closed
- **First observed:** 2026-08-07T17:51:33.871695Z
- **Last observed:** 2026-08-07T17:52:29.0883828Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A scalar incident-status probe used a compact Where-Object expression with an unbalanced brace and stopped before reading the incident or index.

## Impact

No project, controller, provider, deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key state changed.

## Reproduction conditions

The compact `Where-Object` expression omitted a closing brace and PowerShell stopped while parsing the read-only status probe.

## Safe evidence

The corrected multi-line probe returned the incident body status and index row without exposing anything beyond scalar bookkeeping. No provider action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Compact status probe: parser failure before file reads; no state change.
2. Multi-line scalar probe: completed successfully.

## Cause classification

- **Confirmed cause:** Missing closing brace in a compact PowerShell expression.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The incident/index files and provider state were not at fault.
- **Known exclusions:** No deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action.

## Correction and prevention

- **Correction:** Use multi-line PowerShell statements for status probes.
- **Prevention:** Avoid dense nested expressions and run parser-safe scalar checks before patching.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful multi-line status probe.

## Recurrence history

- 2026-08-07T17:51:33.871695Z: First observed.
- 2026-08-07T17:52:29.0883828Z: Multi-line scalar probe completed; incident
  closed.
