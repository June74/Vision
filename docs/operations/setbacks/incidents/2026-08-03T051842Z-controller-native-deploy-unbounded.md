# SB-20260803-051842-controller-native-deploy-unbounded: Controller deployment subprocess had no timeout or visible prompt channel

- **Status:** closed
- **First observed:** 2026-08-03T05:18:42.6108879Z
- **Last observed:** 2026-08-03T17:52:43.9761767Z
- **Phase/task:** Phase B corrected candidate deployment
- **Environment:** Owner-run local PowerShell controller
- **Version/commit:** Candidate `c1911f8`; deployment state not yet re-established

## Symptom

After accepting the fresh pre-deployment baseline, the controller remained
running for many minutes without creating either a candidate-stage or
rollback-stage schedule challenge.

## Impact

The candidate deployment outcome is uncertain until the subprocess is stopped
and the active version is checked read-only. No candidate acceptance claim can
be made.

## Safe evidence

The controller source invokes Wrangler synchronously with standard output and
standard error suppressed, no native-process timeout, and no noninteractive
prompt channel. Filesystem monitoring found neither post-deployment challenge.
No command line, provider response, URL, identifier, token, or secret was read.

## Cause classification

- **Confirmed cause:** The controller's native command wrapper has no bounded
  timeout and suppresses the diagnostic/prompt streams.
- **Hypothesis:** Wrangler is blocked on network I/O or an interactive
  condition; the exact internal state is not inferred without evidence.
- **Known exclusions:** The fresh baseline proof passed before this stage, and
  no candidate or rollback schedule proof was requested.

## Correction and prevention

- **Correction:** Interrupt the unbounded owner-run process, then perform a
  read-only exact rollback-state validation before deciding whether rollback is
  needed. Repair the controller with a bounded child-process contract before
  retrying deployment.
- **Prevention:** Every external native mutation must have a timeout, explicit
  noninteractive behavior, captured safe exit classification, and a recovery
  path for uncertain outcomes.
- **Owner:** Codex.

## Verification and related work

The owner interrupted the unbounded subprocess. The controller returned the
safe category `candidate_deploy_failed` with both `rolled_back` and
`rollback_verified` false. No candidate-stage or rollback-stage challenge was
created. A later strictly read-only controller run returned
`current_rollback_valid: true`, re-establishing the known-good active version.
The final repair uses direct process ownership, bounded chunked capture,
deadline-bound tree cleanup, explicit Wrangler and pnpm adapters, classified
adapter failures, and explicit candidate/rollback uncertainty. The full
twelve-check suite passed and independent review found no remaining Critical or
Important issue.

## Recurrence history

- 2026-08-03T05:18:42.6108879Z: Unbounded deployment wait diagnosed; safe
  interruption and read-only state recheck initiated.
- 2026-08-03T05:20:43.7132920Z: Owner stopped the process. Candidate deployment
  failed and rollback was not verified; active state remains uncertain.
- 2026-08-03T16:46:32.9550955Z: Read-only validation had already confirmed the
  known-good rollback active. The owner then ran the disposable native timeout
  regression and reported `native_timeout_contract_ok`, verifying the first
  bounded-process and cleanup contract without network or provider access.
- 2026-08-03T17:52:43.9761767Z: Complete controller regression and independent
  review passed; incident closed before any candidate redeployment.
