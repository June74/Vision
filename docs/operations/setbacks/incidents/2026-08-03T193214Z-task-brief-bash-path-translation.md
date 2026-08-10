# SB-20260803-193214-task-brief-bash-path-translation: Task-brief retry used an invalid Git Bash path

- **Status:** closed
- **First observed:** 2026-08-03T19:32:14.831806Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter subagent dispatch
- **Environment:** Local Windows/Git-Bash helper attempt
- **Version/commit:** Documentation/review helper only; no provider mutation

## Symptom

The elevated task-brief retry passed a C:/ path that this Git Bash session did not resolve; the helper was not found and the wrapper timed out.

## Impact

No files or provider state changed; dispatch remains delayed until the helper is called through its /c/Users path.

## Reproduction conditions

The path translation was invalid for the selected Bash runtime; the helper was
abandoned in favor of exact native PowerShell paths.

## Safe evidence

Only the bounded helper launch failure was retained. No private or secret value
was emitted.

## Attempts and outcomes

- The invalid `C:/` path retry was stopped.
- Exact native PowerShell paths completed the required local review reads.

## Cause classification

- **Confirmed cause:** The Windows Bash runtime did not resolve the supplied
  path form.
- **Hypotheses:** None.
- **Rejected hypotheses:** Repository absence was not the cause.
- **Known exclusions:** No provider, credential, key, or deployment action ran.

## Correction and prevention

- **Correction:** Use native PowerShell path handling for Windows worktrees.
- **Prevention:** Avoid guessing Git-Bash path translations in this host.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; native path handling is verified.

## Verification and related work

Later native review packages and local gates completed successfully.

## Recurrence history

- 2026-08-03T19:32:14.831806Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after switching to native PowerShell
  path handling.
