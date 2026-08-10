# SB-20260803-193144-task-brief-bash-logon-session: Task-brief Bash helper could not start in restricted session

- **Status:** closed
- **First observed:** 2026-08-03T19:31:44.231335Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter subagent dispatch
- **Environment:** Local Windows restricted session
- **Version/commit:** Documentation/review helper only; no provider mutation

## Symptom

The required task-brief helper failed before execution because bash.exe reported that its Windows logon session did not exist or had terminated.

## Impact

No implementation or provider action occurred; Task 1 dispatch is delayed until the same local-only brief extraction succeeds outside the restricted sandbox or a faithful local fallback is used.

## Reproduction conditions

The Bash helper could not create its logon session in this Windows context;
the native PowerShell fallback was used instead.

## Safe evidence

Only the safe launch-failure category was retained. No private or secret value
was emitted.

## Attempts and outcomes

- Bash dispatch was stopped after the logon-session failure.
- Native PowerShell extraction and bounded review commands completed the same
  local evidence work.

## Cause classification

- **Confirmed cause:** The restricted Windows session could not start the Bash
  helper's logon session.
- **Hypotheses:** None.
- **Rejected hypotheses:** The project source was not missing.
- **Known exclusions:** No provider, credential, key, or deployment action ran.

## Correction and prevention

- **Correction:** Use native PowerShell for bounded brief extraction and review
  on this host.
- **Prevention:** Do not retry the unavailable Bash logon path.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the native fallback is the supported path.

## Verification and related work

Native fallback evidence and later review gates passed.

## Recurrence history

- 2026-08-03T19:31:44.231335Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after native PowerShell fallback and
  subsequent local review completion.
