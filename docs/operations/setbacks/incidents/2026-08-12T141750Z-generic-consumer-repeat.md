# SB-20260812-141750 - GitHub observer still returned generic consumer failure

- **Status:** contained
- **Detected:** 2026-08-12T14:17:50Z
- **Last observed:** 2026-08-12T18:15:59Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The fresh observer was rebased and pinned to `568b36b616ced4e7c56e81c135c9d7ddb1f3cb9c`. Its one matching GitHub run completed with the privacy-safe lifecycle tuple `consumer_unrecognised`, `consumer_exit=1`, and `producer_closed_first=false`. No raw runner stderr was retained. The local end-to-end CLI harness preserves fixed categories through immediate nonzero close.
- **Impact:** No deployment, rollback, database, R2, Queue, backup-key, Worker-configuration, or application-state mutation occurred. The maintenance gate remains pending.
- **Interpretation:** The consumer closed on its own with exit code `1`; the producer did not close first. The runner emitted stderr, but its dialect was not recognized by the current fixed marker matcher. The exact stderr text remains intentionally undisclosed.
- **Correction:** The new supervisor instrumentation made the failure legible without exposing provider output. No application or provider change was made.
- **Next action:** Widen the safe marker matcher only after reviewing the runner's bounded, privacy-safe dialect contract; do not treat this instrumentation result as a fix. Do not rotate credentials, deploy, or open a support case from the earlier false `not_found` hypothesis.
