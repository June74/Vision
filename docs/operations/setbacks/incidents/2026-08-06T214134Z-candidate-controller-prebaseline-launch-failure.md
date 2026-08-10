# SB-20260806-214134-candidate-controller-prebaseline-launch-failure: Candidate controller stopped before baseline challenge

- **Status:** contained
- **First observed:** 2026-08-06T21:41:34.2682460Z
- **Last observed:** 2026-08-06T21:46:14.4440973Z
- **Phase/task:** Phase B classifier-enabled monitored candidate deployment
- **Environment:** Outside-sandbox Windows PowerShell controller launch with normal saved Wrangler authentication
- **Version/commit:** Reviewed controller head `8793f88a36718446c012e207aabd82dfd2ef056e`; no application or provider mutation confirmed

## Symptom

The single authorized controller process exited before producing a fresh
baseline schedule challenge. Its stdout was short but not JSON-decodable and
stderr was nonempty, so the final-result contract was not satisfied.

## Impact

The candidate deployment did not reach baseline confirmation or candidate
dispatch. No automatic rollback was invoked. The preview remains on its prior
healthy deployment.

## Reproduction conditions

Launch the controller through the current outside-sandbox PowerShell launcher
and observe process exit before the baseline challenge timestamp advances.

## Safe evidence

- Process stopped before the fresh baseline challenge.
- Candidate and rollback challenge files were not created for this run.
- Stdout and stderr were preserved locally under the unique run log names; raw
  content is not emitted or copied into this record.
- The bounded safe category is `unknown_failure`; no sanitized controller JSON
  result was available.

## Attempts and outcomes

- Exactly one authorized launch was performed.
- No retry, manual deploy, rollback, schedule change, binding change, secret
  change, or provider-setting action followed.
- The run is stopped pending diagnosis and a new authorization if a retry is
  desired.

## Cause classification

- **Confirmed cause:** The controller launch failed before its baseline
  challenge/result contract; the underlying text is intentionally retained
  only in the bounded local logs for safe later diagnosis.
- **Hypotheses:** The outside-sandbox launcher or child invocation may have
  failed before controller entry; this is not yet confirmed.
- **Rejected hypotheses:** Candidate upload or rollback failure; neither stage
  was reached.
- **Known exclusions:** No candidate version, rollback version, schedule,
  binding, secret, key, Google, Neon, R2, AI Gateway, or calendar mutation was
  authorized or observed in this run.

## Correction and prevention

- **Correction:** Do not retry under the consumed authorization. Diagnose the
  local launch path from bounded logs, then obtain a fresh authorization before
  any new monitored run.
- **Prevention:** Validate the exact child invocation and path quoting with a
  local no-provider dry run before requesting the next live authorization.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Use the corrected direct-process launcher only
  after a new explicit authorization; no provider action is permitted in this
  incident.

## Verification and related work

The local `Start-Process` path collision was confirmed and logged separately.
A direct `System.Diagnostics.Process` no-provider harness probe passed with
exit zero and empty stderr. The underlying child stderr from the consumed live
launch remains local-only and unclassified.

## Recurrence history

- 2026-08-06T21:41:34.2682460Z: First observed and contained before baseline
  challenge or candidate dispatch.
- 2026-08-06T21:46:14.4440973Z: Direct process launcher correction passed the
  no-provider harness; live retry remains gated by fresh authorization.
