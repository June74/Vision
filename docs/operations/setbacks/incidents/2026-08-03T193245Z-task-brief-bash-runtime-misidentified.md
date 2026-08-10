# SB-20260803-193245-task-brief-bash-runtime-misidentified: Task-brief retry misidentified the available Bash runtime

- **Status:** closed
- **First observed:** 2026-08-03T19:32:45.642941Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter subagent dispatch
- **Environment:** Local Windows runtime discovery
- **Version/commit:** Documentation/review helper only; no provider mutation

## Symptom

The second path retry assumed Git Bash, but bash.exe is the Windows Apps WSL alias; /c/Users therefore did not expose the helper.

## Impact

No implementation or provider action occurred; repeated path guessing was stopped and the runtime was identified before choosing one final extraction method.

## Reproduction conditions

The available `bash.exe` was a Windows Apps/WSL alias rather than the assumed
Git Bash runtime, so path retries were stopped and native PowerShell was used.

## Safe evidence

Only safe runtime-classification facts were retained. No private or secret
value was emitted.

## Attempts and outcomes

- Runtime inspection identified the mismatch.
- Native PowerShell completed the intended bounded local work.

## Cause classification

- **Confirmed cause:** The host's Bash alias was not the assumed Git Bash
  runtime.
- **Hypotheses:** None.
- **Rejected hypotheses:** Repeated path guessing was not a reliable fix.
- **Known exclusions:** No provider, credential, key, or deployment action ran.

## Correction and prevention

- **Correction:** Use the proven native PowerShell fallback.
- **Prevention:** Identify the executable runtime before constructing paths.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the native fallback is established.

## Verification and related work

Later bounded native reviews and local gates passed.

## Recurrence history

- 2026-08-03T19:32:45.642941Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after runtime identification and
  native fallback verification.
