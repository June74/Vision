# SB-20260726-205519-bash-review-package-unavailable: Bash review-package helper could not start

- **Status:** closed
- **First observed:** 2026-07-26T20:55:19.3868194Z
- **Last observed:** 2026-07-28T22:51:02.2002810Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 handoff
- **Environment:** Local Windows PowerShell
- **Version/commit:** `0f08fc1`

## Symptom

The skill-provided Bash review-package helper could not start because its
Windows logon session was unavailable.

## Impact

The helper produced no review package. The committed task change and remote
branch were unaffected.

## Reproduction conditions

Launch the Bash helper from this current Windows session.

## Safe evidence

PowerShell reported a resource-unavailable logon-session category before the
script ran.

## Attempts and outcomes

- The Bash helper failed before creating an artifact.
- The documented non-Bash fallback was selected.

## Cause classification

- **Confirmed cause:** The Bash-based skill helper is not reliably available
  in this Windows session. Earlier attempts found an unusable executable or
  missing Unix utilities; the latest bounded lookup found no Bash executable
  on `PATH`.
- **Hypotheses:** None.
- **Rejected hypotheses:** The Git range and helper path were both resolved.
- **Known exclusions:** No repository or provider state changed.

## Correction and prevention

- **Correction:** Generate the review package with PowerShell using the exact
  base and head commits.
- **Prevention:** Prefer the documented PowerShell fallback in this desktop
  session.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The PowerShell fallback produced a 36,835-byte package for
`9f5a0d5..9620e06`; all four required section markers were present.

## Recurrence history

- 2026-07-26T20:55:19.3868194Z: First observed.
- 2026-07-26T20:56:46.7294087Z: Closed with verified fallback package
  generation.
- 2026-07-27T02:40:08Z: Recurred when the task-brief helper started under
  Git Bash but its required `awk` utility was unavailable. It produced only
  an empty ignored scratch file; the deterministic PowerShell extraction
  fallback is used for all restore-task briefs and review packages.
- 2026-07-27T18:19:36Z: Recurred when the review-package helper started under
  Git Bash but its required `dirname` utility was unavailable. It created no
  review artifact. The exact-range PowerShell fallback was selected again;
  future work in this desktop session must skip the Bash helper entirely.
- 2026-07-27T21:10:55Z: Recurred when the Task 1 brief helper could not launch
  `bash.exe` because the Windows logon session was unavailable. No artifact or
  repository mutation occurred. Deterministic PowerShell extraction is used.
- 2026-07-28T01:13:37.0861005Z: Recurred before the Task 3 handoff when a
  bounded executable lookup found no Bash executable on `PATH`. No artifact,
  provider action, or repository mutation occurred. The exact approved plan
  section is passed directly to the subagent instead.
- 2026-07-28T18:40:34Z: Recurred when the required task-brief helper launched
  through the discovered Git Bash executable but its `awk` dependency was
  unavailable. No source or provider state changed. The exact Task 1 section
  is extracted with the already verified deterministic PowerShell fallback.
- 2026-07-28T22:51:02.2002810Z: Recurred when generating the final Task 3
  review package; `bash.exe` could not start because the Windows logon session
  was unavailable. No artifact or repository state changed. The documented
  typed-list PowerShell fallback is used.
