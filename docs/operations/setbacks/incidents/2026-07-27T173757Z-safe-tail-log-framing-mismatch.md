# SB-20260727-173757-safe-tail-log-framing-mismatch: Restore evidence was missing from safe-tail

- **Status:** contained
- **First observed:** 2026-07-27T17:37:57Z
- **Last observed:** 2026-07-27T17:37:57Z
- **Phase/task:** Phase B restore Task 4
- **Environment:** GitHub safe-tail workflow log and local PowerShell classifier
- **Version/commit:** reviewed candidate `41b05fd`, workflow run 33

## Symptom

The successful safe-tail workflow returned the closed
`no_scheduled_event` category with an unknown outcome instead of one
`vision.preview-restore/v1` result.

## Impact

The restore is not accepted. The disposable branch remains retained, cleanup
and branch deletion are blocked, and the temporary candidate must be replaced
by verified normal code before diagnosis continues.

## Reproduction conditions

Run the guarded safe-tail workflow for the temporary every-minute restore
candidate and wait through its bounded capture window.

## Safe evidence

The workflow completed successfully and the bounded classifier returned one
`no_scheduled_event` result with an unknown outcome. No raw line was returned.

## Attempts and outcomes

- The safe-tail workflow completed with success.
- The first extractor looked only for restore evidence and found none.
- A fixed category count then confirmed one `no_scheduled_event` result and no
  succeeded, failed, restore-marker, or backup-restore-action result.
- No raw log inspection was emitted.

## Cause classification

- **Confirmed cause:** No scheduled restore evidence reached the bounded tail
  capture window.
- **Hypothesis:** The newly registered every-minute schedule was not active
  inside the 85-second capture window. Official Cloudflare Cron Triggers
  documentation states that trigger additions, updates, and deletions can
  take several minutes, up to 15 minutes, to propagate.
- **Rejected hypotheses:** Provider log framing was not the cause; the closed
  fallback category was present. The workflow itself did not fail.
- **Known exclusions:** No secret, token, database URL, branch identifier,
  account identifier, provider URL, OAuth value, or raw log entered the output.

## Correction and prevention

- **Correction:** Fail closed, redeploy a verified normal two-cron Worker, keep
  the disposable branch, and diagnose schedule activation without deletion.
- **Prevention:** Require positive `vision.preview-restore/v1` evidence; a
  successful workflow exit alone never proves a restore.
- **Owner:** Codex.
- **Next diagnostic step:** Deploy an immutable normal ref verified to have
  zero temporary runtime references and the exact two normal schedules.

## Verification and related work

The incident remains contained. Cleanup and branch deletion are prohibited
until a later restore attempt returns exactly one valid
`vision.preview-restore/v1` object and all required fields pass.

## Recurrence history

- 2026-07-27T17:37:57Z: First observed as an extractor mismatch, then corrected
  to the confirmed missing scheduled-event category after fixed count-only
  classification.
- 2026-07-27: Candidate deployment logs confirmed all three schedules were
  submitted, while official provider documentation establishes a propagation
  window much longer than the 85-second tail. This supports, but does not yet
  prove, the propagation-delay hypothesis.
