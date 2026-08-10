# SB-20260803-002836-corrected-controller-execution-policy: Windows blocked the unsigned corrected redeploy controller

- **Status:** closed
- **First observed:** 2026-08-03T00:28:36.1082872Z
- **Last observed:** 2026-08-03T17:33:37.6795558Z
- **Phase/task:** Phase B corrected candidate retry and final controller review repair
- **Environment:** Local Windows PowerShell
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

Direct invocation of the ignored corrected redeploy controller stopped before
its first statement because the local execution policy rejects unsigned
PowerShell scripts.

## Impact

The read-only dry run did not start. No repository, Worker, provider setting,
schedule, binding, Google state, database state, calendar, credential, or key
changed.

## Reproduction conditions

Invoke the local `.ps1` file directly from a PowerShell session on this machine
without a process-scoped execution-policy override.

## Safe evidence

Only the fixed Windows security exception category was retained. No provider
payload, URL, credential, account data, protected identifier, or response body
was retained.

## Attempts and outcomes

- Parser validation had already completed with zero errors.
- The direct launch was rejected before controller execution.

## Cause classification

- **Confirmed cause:** The machine's script-signing policy rejects this local
  unsigned operational helper.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Candidate, rollback, Cloudflare authentication, and
  live-state failures; controller code did not execute.
- **Known exclusions:** No persistent execution-policy setting was changed.

## Correction and prevention

- **Correction:** Launch the exact file through a new PowerShell process with
  `-NoProfile -ExecutionPolicy Bypass -File`.
- **Prevention:** Operational instructions for local ignored PowerShell helpers
  must use the process-scoped launcher explicitly on this machine.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the read-only rollback validation through the
  process-scoped launcher and record only its safe summary.

## Verification and related work

The process-scoped launcher executed the exact script, which passed parsing,
artifact validation, authentication with approved network access, and active
version attribution before correctly stopping at a separate provider-state
precondition.

## Recurrence history

- 2026-08-03T00:28:36.1082872Z: First observed and contained before controller
  execution.
- 2026-08-03T00:36:28.2471845Z: Closed after the process-scoped launcher ran
  the exact controller without changing the persistent execution policy.
- 2026-08-03T17:33:37.6795558Z: Two local static regression scripts were
  mistakenly invoked directly and were rejected before execution. The required
  process-scoped `ExecutionPolicy Bypass` launcher was restored immediately;
  no external or product state changed.
