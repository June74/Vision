# SB-20260803-044415-baseline-evidence-patch-context: Schedule evidence replacement was not verified and the controller timed out

- **Status:** closed
- **First observed:** 2026-08-03T04:44:15.1804211Z
- **Last observed:** 2026-08-03T04:57:39.6452989Z
- **Phase/task:** Phase B corrected-controller baseline schedule proof
- **Environment:** Local ignored controller evidence file
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

The first patch intended to replace the stale one-line baseline schedule
evidence did not match the file context and made no change. A combined
delete-and-add patch then returned success, but the file still contained the
old proof. Because that result was not read back before declaring submission,
the controller rejected the stale correlation until its bounded timeout.

## Impact

The owner had to repeat a baseline controller run. No external state,
credential, calendar, database, or key changed; the candidate was not deployed.

## Safe evidence

The post-timeout field comparison showed that the evidence nonce and issued
time did not match the fresh challenge and that the evidence file predated the
challenge. The active-version hash happened to match, which was insufficient
for admission. No raw provider identifier was required.
On the clean rerun, immediate read-back also found that the first fresh proof
serialized the daily cron with one extra field. That exact field was corrected
inside the challenge window, and a second read-back passed every admitted
Boolean.

## Cause classification

- **Confirmed cause:** The whole-line patch context did not match, and the
  subsequent same-patch delete/add operation did not replace the file despite
  returning success.
- **Contributing cause:** The file was not read back and field-compared before
  reporting that the proof had been submitted.
- **Contributing cause:** The first clean-rerun proof manually transcribed the
  daily cron with one extra wildcard even though the owner confirmed the
  correct five-field expression.
- **Known exclusions:** The challenge file and owner schedule confirmation were
  current; no provider failure occurred.

## Correction and prevention

- **Correction:** Delete the stale disposable evidence in a separate patch,
  verify absence, then add the new proof in a separate patch and independently
  verify every admitted field before waiting for the controller result.
- **Prevention:** A successful write-tool return is not evidence of the desired
  file state. Every time-bounded proof write requires immediate read-back and
  Boolean-only contract comparison.
- **Owner:** Codex.

## Verification and related work

The controller safely returned `live_schedule_evidence_timeout`. The stale
evidence file was then deleted in a separate patch and its absence was
verified. On the clean rerun, the newly added proof was immediately read back;
the extra cron field was detected, corrected, and then all schema, source,
label, nonce, time, version-hash, freshness, and cron checks passed. The
incident remains contained until the controller returns its authoritative
result. The controller subsequently returned `current_rollback_valid: true`,
closing the incident.

## Recurrence history

- 2026-08-03T04:44:15.1804211Z: First occurrence, corrected immediately.
- 2026-08-03T04:53:54.8198287Z: Post-timeout comparison proved the combined
  replacement had not occurred. The stale disposable file was deleted and its
  absence verified before any rerun.
- 2026-08-03T04:56:29.1875964Z: Clean-rerun read-back caught an extra daily-cron
  wildcard before the deadline. The corrected proof then passed every local
  admission check.
- 2026-08-03T04:57:39.6452989Z: Owner reported the authoritative controller
  result `current_rollback_valid: true`; incident closed.
