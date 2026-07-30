# SB-20260729-191154-subagent-thread-limit: Optional runbook auditor hit the subagent-thread limit

- **Status:** closed
- **First observed:** 2026-07-29T19:11:54.8575979Z
- **Last observed:** 2026-07-30T19:55:35.8993222Z
- **Phase/task:** Phase B Task 7 final review and live-runbook preparation
- **Environment:** Codex subagent coordination
- **Version/commit:** `84a6fe7`

## Symptom

An optional third read-only reviewer could not be created because the current
task had reached its subagent-thread limit.

## Impact

The two required independent reviews continued unaffected. Only parallel
preparation of the post-review live-acceptance runbook was delayed. No file,
provider, database, deployment, or secret state changed.

## Reproduction conditions

Attempt to create another subagent while the current task already retains the
maximum number of subagent threads.

## Safe evidence

The coordination tool returned only the fixed category that the agent thread
limit was reached.

## Attempts and outcomes

- The optional auditor spawn was rejected before the subagent began.
- Runbook preparation remains assigned to the controller after an existing
  reviewer thread finishes.

## Cause classification

- **Confirmed cause:** The current task reached the platform's subagent-thread
  limit.
- **Hypotheses:** None.
- **Rejected hypotheses:** The failure was not caused by repository state,
  network access, credentials, or the runbook request itself.
- **Known exclusions:** No protected value or external response was involved.

## Correction and prevention

- **Correction:** Reuse a completed reviewer thread or prepare the runbook
  locally after the required reviews finish.
- **Prevention:** Reserve one available thread before starting optional
  parallel audits during the final review phase.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both required reviewer threads remained active after the optional spawn was
rejected and later completed. A completed thread is now available for the
consolidated fix wave, so the coordination delay is closed.

## Recurrence history

- 2026-07-29T19:11:54.8575979Z: First observed and contained.
- 2026-07-29T19:38:09.4855675Z: Required reviews completed and a reusable
  thread became available; incident closed.
- 2026-07-30T19:55:35.8993222Z: An optional Task 9 brief-preparation spawn was
  rejected because Task 1's implementer had correctly used the remaining slot
  for its required fix review. Task 1 review and Task 8 preparation continued;
  no file, provider, private-data, or external state changed, and Task 9
  preparation is deferred until a slot opens.
