# Setback SB-20260801-005003-gate0-result-shape-assumption

- **Status:** closed
- **Detected:** 2026-08-01T00:50:03.2308020Z
- **Last observed:** 2026-07-31T21:05:30.8216889-05:00
- **Scope:** Phase B Gate 0 preview candidate checks

## What happened

The preview build exited zero, but the JavaScript controller skipped the
following preview deploy check because it assumed the nested shell result
exposed a structured `exit_code` property. The result was rendered output, so
the guard treated an absent property as failure and ended early.

## Impact

The preview deploy check was delayed and remained unexecuted at detection. The
preview build succeeded. No deployment or provider state changed.

## Cause classification

- **Confirmed cause:** The controller inferred an unsupported nested-tool
  result shape.
- **Rejected hypothesis:** Preview build failure; its authoritative exit was
  zero.

## Correction and prevention

- **Correction:** Run each required gate as a direct bounded shell call and use
  that call's exit code.
- **Prevention:** Do not branch on undocumented nested-result properties.
- **Owner:** Codex.
- **Verification:** The direct `deploy:check:preview` retry exited zero.

## Recurrence history

- 2026-07-31T21:05:30.8216889-05:00: The Task 7 continuation status report
  incorrectly counted six staged ledger paths instead of the five reported by
  `git status --short`. No repository or external state changed because the
  count was corrected before committing. The final cached-set check will count
  paths from Git rather than from a manual summary.
