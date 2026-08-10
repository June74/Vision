# SB-20260803-210855-candidate-duplicate-guard-self-match: Candidate duplicate-process guard matched its own launcher

- **Status:** closed
- **First observed:** 2026-08-03T21:08:55.666830Z
- **Last observed:** 2026-08-07T19:54:44Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Approved outside-sandbox Windows PowerShell launcher
- **Version/commit:** `8793f88a36718446c012e207aabd82dfd2ef056e`; launcher diagnostic only

## Symptom

The narrowed outside-sandbox launcher stopped before process start because its command-line process search counted the current launcher as an existing candidate controller.

## Impact

No controller or provider action occurred; the still-unused deployment authorization was delayed while the guard is corrected to exclude its own process.

## Reproduction conditions

Search every process command line for the controller filename and mode from a
launcher whose own command line contains those same literals, without
excluding the current process.

## Safe evidence

The guard returned `candidate_controller_already_running` before
`Start-Process`; the unique active-run state file remained absent.

## Attempts and outcomes

The self-matching guard stopped once. A corrected launcher relied on the unique
active-run state file and started exactly one hidden controller process.

## Cause classification

- **Confirmed cause:** The command-line predicate matched the launcher process
  that contained the predicate's own controller and mode text.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** A prior candidate controller was already running.
- **Known exclusions:** The failed guard launched no child process and made no
  provider call or mutation.

## Correction and prevention

- **Correction:** Use the unique active-run state file as the launch guard for
  this controlled one-run operation.
- **Prevention:** Never use command-line substring enumeration as an authority
  for duplicate-process decisions without excluding the inspecting process and
  validating a separate run identity.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected launcher created its unique state record and exactly one live
controller process.

## Recurrence history

- 2026-08-03T21:08:55.666830Z: First observed.
- 2026-08-03T21:25:23.6971358Z: Corrected state-file guard verified; incident
  closed.
- 2026-08-07T19:54:44Z: A local preflight command-line search counted its own
  inspection process as one controller. The result was discarded; the corrected
  self-excluding check reported zero live controllers before launch. No provider
  action occurred.
