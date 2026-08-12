# SB-20260812-141750 - GitHub observer still returned generic consumer failure

- **Status:** closed
- **Detected:** 2026-08-12T14:17:50Z
- **Last observed:** 2026-08-12T20:47:32.118Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The fresh observer was rebased and pinned to `568b36b616ced4e7c56e81c135c9d7ddb1f3cb9c`. Its one matching GitHub run completed with the privacy-safe lifecycle tuple `consumer_unrecognised`, `consumer_exit=1`, and `producer_closed_first=false`. No raw runner stderr was retained. The local end-to-end CLI harness preserves fixed categories through immediate nonzero close.
- **Impact:** No deployment, rollback, database, R2, Queue, backup-key, Worker-configuration, or application-state mutation occurred. The maintenance gate remains pending.
- **Interpretation:** The consumer closed on its own with exit code `1`; the producer did not close first. The runner emitted stderr, but its dialect was not recognized by the current fixed marker matcher. The exact stderr text remains intentionally undisclosed.
- **Correction:** The new supervisor instrumentation made the failure legible without exposing provider output. No application or provider change was made.
- **Next action:** Widen the safe marker matcher only after reviewing the runner's bounded, privacy-safe dialect contract; do not treat this instrumentation result as a fix. Do not rotate credentials, deploy, or open a support case from the earlier false `not_found` hypothesis.

## Dialect repair recurrence

At 2026-08-12T18:58:53Z, the first fresh observer after the shared bounded
dialect implementation matched a fixed maintenance marker and returned the
privacy-safe tuple `consumer_maintenance_schedule_mismatch`,
`consumer_exit=1`, and `producer_closed_first=false`. The observer had been
started before the next quarter-hour maintenance tick but its input expected
the following quarter-hour tick, so the Worker emitted the first available
scheduled evidence and the expectation rejected it. This confirms the
matcher and supervisor mapping are functioning; the schedule mismatch was a
harness-input timing error, not an unrecognized stderr dialect or a Worker
configuration defect. No provider, deployment, credential, database, R2,
Queue, or Worker configuration state changed.

The correctly timed retry at 2026-08-12T19:20:04Z disproved the timing-only
harness hypothesis: the input expected the 19:30Z slot and the observer still
received a structurally valid maintenance record with the same fixed-category
failure. A bounded, read-only provider-tail probe at 2026-08-12T19:45:44Z
found the safe tuple `observedTimestampFound=true`, `exactMatch=false`,
`differenceSeconds=56`, `minuteAligned=false`, and `quarterHourAligned=true`.
The live Worker therefore reports the correct quarter-hour schedule slot with
a seconds-level delivery offset, while the expectation matcher requires the
nominal `:00.000Z` string exactly. No raw timestamp, provider response,
credential, deployment, database, R2, Queue, or Worker configuration state was
retained or changed.

The correction is a narrowly scoped application fix: normalize only the
calendar-maintenance scheduled timestamp to its containing UTC minute at the
scheduled-handler boundary, preserve exact timestamps for other cron families,
and add a regression test through the live scheduled routing path. The
previous next-tick input correction remains necessary for future observers but
does not solve this seconds-level provider delivery offset.

## Closure - 2026-08-12T20:47:32.118Z

After the normal preview acceptance run completed successfully for the reviewed
commit `5ec2887392d935751b591cc36248101b58071ee1`, the fresh
`calendar_maintenance` uniqueness observer for `20:45:00Z` also completed
successfully. Admission, exact checkout, dependency setup, and the allowlisted
tail capture all passed; no deployment, rollback, credential, database, R2,
Queue, or Worker configuration state changed during observation. The scoped
timestamp normalization is therefore live and its maintenance evidence gate is
closed.
