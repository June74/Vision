# SB-20260806-213943-powershell-crypto-api-mismatch: PowerShell crypto API was unavailable

- **Status:** closed
- **First observed:** 2026-08-06T21:39:43.5203008Z
- **Last observed:** 2026-08-06T21:42:38.6464619Z
- **Phase/task:** Phase B monitored candidate deployment safe-error diagnosis
- **Environment:** Local Windows PowerShell read-only log probe
- **Version/commit:** Phase B worktree; no application or provider change

## Symptom

A bounded diagnostic used the newer static `SHA256.HashData` API, which is not
available in the installed PowerShell/.NET runtime.

## Impact

That one diagnostic stopped before producing its safe summary. The candidate
controller had already exited before this probe; no retry or provider action
followed.

## Reproduction conditions

Call `[System.Security.Cryptography.SHA256]::HashData(...)` in this runtime.

## Safe evidence

PowerShell reported a `MethodNotFound` category. No log content, credential,
provider payload, identifier, or secret was emitted.

## Attempts and outcomes

- The incompatible probe was discarded.
- A compatible instance-based hash probe is being used instead.
- No deployment, schedule, binding, secret, or external state changed.

## Cause classification

- **Confirmed cause:** The runtime lacks the newer static hash helper.
- **Hypotheses:** None.
- **Rejected hypotheses:** A controller or provider failure caused this probe;
  the failure occurred in the diagnostic itself.
- **Known exclusions:** No network or provider mutation occurred.

## Correction and prevention

- **Correction:** Use `SHA256.Create().ComputeHash(...)` only when a digest is
  needed for bounded diagnostics.
- **Prevention:** Keep compatibility probes on APIs supported by the installed
  PowerShell runtime.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The compatible instance-based probe completed and returned only bounded line
shapes and a non-identifying digest prefix; no raw log content was emitted.

## Recurrence history

- 2026-08-06T21:39:43.5203008Z: First observed and contained.
- 2026-08-06T21:42:38.6464619Z: Closed after the compatible probe completed
  without project or external mutation.
