# SB-20260803-040700-manual-controller-output-unobservable: Manual controller output was not attached to the task

- **Status:** closed
- **First observed:** 2026-08-03T04:07:00.4870269Z
- **Last observed:** 2026-08-03T19:04:29.4027038Z
- **Phase/task:** Phase B corrected candidate deployment and read-only rollback validation
- **Environment:** Owner-run local PowerShell controller
- **Version/commit:** Candidate `c1911f8`; candidate not yet deployed

## Symptom

After the owner confirmed the baseline schedules and the nonce-bound proof was
written, the Codex task had no attached terminal stream from which to read the
controller's safe JSON result.

## Impact

Baseline success or its fixed failure category cannot yet be recorded. The
candidate remains undeployed.

## Safe evidence

The challenge was fresh and the proof was written within its bounded window.
The application terminal reader reported no attached session. A fallback WMI
process-count check was denied by local permissions and yielded no usable state.
No process command line, identifier, credential, or provider response was read.

## Cause classification

- **Confirmed cause:** The owner launched the controller in a terminal not
  attached to this Codex task.
- **Known exclusions:** The proof file itself was written successfully.

## Correction and prevention

- **Correction:** Ask the owner to report only `passed` or the controller's
  fixed `failure_category` from the terminal.
- **Prevention:** For manual execution bridges, establish the output handoff
  before starting the bounded challenge.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Read the safe terminal result from the owner.

## Verification and related work

The owner returned the fixed safe category `provider_binding_contract_invalid`.
No raw output or sensitive field was required; incident closed.

## Recurrence history

- 2026-08-03T04:07:00.4870269Z: First observed and contained without data access.
- 2026-08-03T04:08:31.5638225Z: Owner supplied the safe category; incident closed.
- 2026-08-03T19:04:29.4027038Z: Recurred when the approved hidden read-only
  launcher returned no run summary despite exiting zero. Its uniquely named
  stdout/stderr files were present; stderr was empty and the allowlisted stdout
  result decoded to `wrangler_json_query_failed`. No raw provider output,
  process command line, secret, or mutation was read.
