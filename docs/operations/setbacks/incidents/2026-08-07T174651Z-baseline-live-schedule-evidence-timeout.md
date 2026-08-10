# SB-20260807-174651-baseline-live-schedule-evidence-timeout: Baseline schedule evidence arrived after the bounded controller wait

- **Status:** contained
- **First observed:** 2026-08-07T17:46:51.876619Z
- **Last observed:** 2026-08-10T01:22:17.8988704Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Preview controller, Windows direct launcher, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

The controller generated a fresh baseline challenge and exited with the safe category live_schedule_evidence_timeout before candidate dispatch; the nonce-bound evidence was valid but arrived after the bounded wait window.

## Impact

No candidate deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key mutation occurred. The single approval is consumed by this stopped pre-dispatch attempt.

## Reproduction conditions

The controller's baseline evidence wait is bounded by its configured schedule-evidence wait. The challenge was issued first; the user confirmation/evidence write arrived after that deadline, so the controller stopped before candidate dispatch.

## Safe evidence

The final safe result was JSON-decodable with zero stderr, `candidate_preconditions_passed=false`, `candidate_accepted=false`, `rolled_back=false`, and `failure_category=live_schedule_evidence_timeout`. Independent local checks showed valid challenge/evidence schema, matching nonce and active-version hash, exactly two crons, and evidence observed after both `issuedAt` and `notBefore`; the evidence was simply too late for the controller wait. Do not paste private or secret values.

## Attempts and outcomes

1. Fresh controller launch reached the baseline challenge.
2. User confirmation arrived after the bounded wait; the controller exited before candidate dispatch.
3. Safe final output was captured and parsed; no retry was launched.
4. 2026-08-10: A fresh approved retry generated a new baseline challenge but
   received no owner confirmation before the 600-second wait expired. The
   safe final result again reported `live_schedule_evidence_timeout`; no
   candidate or rollback challenge was created.

## Cause classification

- **Confirmed cause:** Baseline evidence was submitted after the controller's bounded wait expired.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The challenge/evidence nonce, schema, hash, cron count, and time ordering were valid; no provider failure or candidate deployment occurred.
- **Known exclusions:** No candidate deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key mutation.

## Correction and prevention

- **Correction:** Stop the run at the safe pre-dispatch category and require a new exact approval plus timely schedule confirmation before any future attempt; do not reuse this approval.
- **Prevention:** Keep the operator actively watching the challenge and submit the nonce-bound evidence within the controller's bounded wait; never fabricate or reuse stale evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** When the owner is ready, inspect the two normal preview schedules and reply with the exact fresh confirmation while the challenge is active; do not fabricate or reuse evidence.

## Verification and related work

Verified by the allowlisted final capture, independent challenge/evidence timing audit, and the absence of any live candidate or rollback challenge.

## Recurrence history

- 2026-08-07T17:46:51.876619Z: First observed.
- 2026-08-07T17:48:39.0206699Z: Safe final result and timing audit confirmed
  pre-dispatch timeout; incident closed.
- 2026-08-10T01:22:17.8988704Z: Fresh approved retry again timed out before
  dispatch because the required owner confirmation was not submitted in the
  bounded window; status changed to contained pending a new timely checkpoint.
