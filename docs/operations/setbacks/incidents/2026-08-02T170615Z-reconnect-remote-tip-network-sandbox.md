# SB-20260802-170615-reconnect-remote-tip-network-sandbox: Reconnect remote-tip assertion failed inside the restricted network sandbox

- **Status:** closed
- **First observed:** 2026-08-02T17:06:15.450394Z
- **Last observed:** 2026-08-02T17:06:38.8415571Z
- **Phase/task:** Phase B reconnect-recovery execution preflight
- **Environment:** Local Phase B linked worktree, default and approved network boundaries
- **Version/commit:** `94b8810`

## Symptom

The repository-local privacy-safe Git adapter returned only its fixed failure message while checking the remote branch tip in the default sandbox.

## Impact

Preflight stopped before implementation. No repository, provider, deployment, database, credential, calendar, key, or backup state changed.

## Reproduction conditions

Run the privacy-safe remote-tip adapter in the default restricted network
sandbox, then repeat the identical read-only assertion with approved network
access.

## Safe evidence

The default run retained only the fixed message `Privacy-safe Git operation
failed.` The approved retry returned only the expected Boolean success facts.
No remote identifier, URL, commit value, credential, or raw child output was
retained.

## Attempts and outcomes

- The default-sandbox adapter attempt failed closed.
- The identical read-only adapter attempt with approved network access proved
  the remote tip and planning-only delta successfully.

## Cause classification

- **Confirmed cause:** The privacy-safe remote assertion required network
  access unavailable in the default sandbox.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** The local wrapper, branch identity, and remote tip
  were not invalid; the approved identical invocation succeeded.
- **Known exclusions:** No remote mutation, push, provider operation,
  deployment, database write, secret access, key change, or calendar action
  occurred.

## Correction and prevention

- **Correction:** Repeat only this read-only privacy-safe adapter boundary with
  approved network access.
- **Prevention:** Classify remote-tip assertions as read-only network
  operations during preflight and retain only Boolean adapter results.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The approved retry returned `remote_tip_verified=true` and
`planning_delta_only=true`. This incident and its index row remain unstaged.

## Recurrence history

- 2026-08-02T17:06:15.450394Z: First observed.
