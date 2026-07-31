# SB-20260731-181107-owned-diff-command-composition: Owned diff checks were joined with a command separator

- **Status:** closed
- **First observed:** 2026-07-31T18:11:07.6040547Z
- **Last observed:** 2026-07-31T18:11:07.6040547Z
- **Phase/task:** Phase B Task 3 fourth-wave lifecycle verification
- **Environment:** Local read-only Git inspection
- **Version/commit:** 5d0946b plus verified lifecycle edits

## Symptom

The lifecycle lane joined `git diff --check` and `git diff --stat` with a
PowerShell semicolon, contrary to the project's command-output composition
rule.

## Impact

Both read-only commands were scoped to owned paths and exited successfully.
Only known line-ending advisories appeared. No file, provider, environment,
network, secret, staging, or commit was changed.

## Cause classification

- **Confirmed cause:** Two logically separate read-only inspections were
  composed in one shell command instead of issued independently.
- **Hypotheses:** None remaining.
- **Known exclusions:** There was no failed validation or sensitive output.

## Correction and prevention

- **Correction:** Treat the successful results as diagnostic only and issue
  future checks as separate calls or structured parallel operations.
- **Prevention:** Do not join shell commands with separators in verification
  lanes.
- **Owner:** Codex.
- **Next diagnostic step:** None; final root verification will run commands
  independently.

## Recurrence history

- 2026-07-31T18:11:07.6040547Z: Observed, contained, and closed with no state
  change.
