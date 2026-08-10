# SB-20260803-194008-git-global-ignore-warning-recurrence: Git global-ignore warning recurred during ignore verification

- **Status:** closed
- **First observed:** 2026-08-03T19:40:08.380730Z
- **Last observed:** 2026-08-07T18:06:34.5380922Z
- **Phase/task:** Phase B TSX adapter Task 1 verification
- **Environment:** Windows PowerShell local Phase B verification
- **Version/commit:** Working tree only; no application or provider mutation

## Symptom

The final local `git diff --check` was invoked under terminating PowerShell
error handling. Git emitted the known unreadable-global-ignore warning on
stderr, and PowerShell surfaced that warning as a command failure even though
the diff check itself had not reported a whitespace error.

## Impact

Both ignored-artifact checks still returned true and no state changed, but verification output was noisy and the known command convention was not followed.

## Reproduction conditions

Run a Git verification command that isolates the known warning channel from
the exit-status assertion; do not suppress an actual nonzero Git exit.

## Safe evidence

Only the safe warning class was observed: unreadable global ignore file. No
private values, repository payloads, credentials, or provider output were
emitted.

## Attempts and outcomes

- The first final-check wrapper stopped on the known warning before reaching
  the parser and direct-launcher contract.
- A corrected bounded rerun will capture Git stderr separately and assert the
  real exit code before continuing.

## Cause classification

- **Confirmed cause:** PowerShell's terminating native-command treatment of
  Git's known global-ignore warning.
- **Hypotheses:** None.
- **Rejected hypotheses:** A diff whitespace failure was not observed.
- **Known exclusions:** No file or provider state changed.

## Correction and prevention

- **Correction:** Capture the warning channel separately, check Git's exit
  code, and only then proceed with the remaining local gates.
- **Prevention:** Do not use terminating error handling around Git commands
  that are known to emit this warning; keep the warning allowlisted and never
  print its raw path.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun `git diff --check` with isolated stderr and
  complete the parser/launcher contract check.

## Verification and related work

The scoped `git diff --check` rerun completed with exit zero while its known
warning channel remained isolated. The direct-launcher parser and contract
also passed afterward. No raw warning text was emitted.

## Recurrence history

- 2026-08-03T19:40:08.380730Z: First observed.
- 2026-08-06T22:01:53.0415023Z: Recurrence during final local diff check;
  contained with no state change.
- 2026-08-06T22:04:15.4269803Z: Closed after scoped diff verification isolated
  the warning and returned exit zero.
- 2026-08-07T18:06:08.4268273Z: Recurrence during a scalar Git status probe;
  warning suppressed and safe status rerun completed.
- 2026-08-07T18:06:34.5380922Z: Corrected scalar status evidence recorded;
  incident closed.
