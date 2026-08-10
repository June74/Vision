# SB-20260803-210737-candidate-launch-approval-control-rejected: Outside-sandbox candidate launch was rejected before process start

- **Status:** contained
- **First observed:** 2026-08-03T21:07:37.346356Z
- **Last observed:** 2026-08-06T23:00:12.000000Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Codex outside-sandbox approval boundary on Windows
- **Version/commit:** `8793f88a36718446c012e207aabd82dfd2ef056e`

## Symptom

The fresh authorized outside-sandbox controller launch was rejected by the execution approval control before any process started.

## Impact

No controller or provider action occurred and the authorized candidate run remains pending; deployment was delayed while the launcher request is narrowed.

## Reproduction conditions

Submit the exact provider-mutating escalation after a prior approval attempt
has been recorded as consumed by the execution boundary.

## Safe evidence

The approval control rejected the primary-agent request before process launch,
reporting that the prior approval was consumed and that no fresh authorization
was recognized. The safe result is zero controller, Wrangler, deployment,
rollback, schedule, or provider activity.

## Attempts and outcomes

The earlier delegated request was rejected once and then corrected by a direct
primary-agent escalation. On 2026-08-06, a new direct escalation was rejected
before process start because the execution reviewer did not recognize the
current-turn authorization as fresh. No retry is permitted until the owner
repeats the exact approval in a new turn.

## Cause classification

- **Confirmed cause:** The execution review state treated the approval as
  already consumed and did not accept the current-turn repetition as a fresh
  authorization for this launch.
- **Hypotheses:** The reviewer may require the exact approval to arrive in a
  separate turn after the rejection.
- **Rejected hypotheses:** The controller, normal saved Wrangler login, and
  provider health were not exercised; none can be blamed for this preflight
  rejection.
- **Known exclusions:** The rejected request started no process and changed no
  provider or local application state.

## Correction and prevention

- **Correction:** Stop after the rejection and request a new exact approval in
  a separate user turn before submitting the single controller command again.
- **Prevention:** Treat every execution-boundary rejection as consuming the
  attempted authorization path; never work around it with an indirect launch
  or a second command in the same turn.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The earlier corrected escalation was accepted and started exactly one
controller run. The 2026-08-06 retry was rejected before process start; its
safe preflight result is recorded above.

## Recurrence history

- 2026-08-03T21:07:37.346356Z: First observed.
- 2026-08-03T21:25:23.6971358Z: Corrected direct escalation verified;
  incident closed.
- 2026-08-06T23:00:12.000000Z: Current-turn approval was not recognized as
  fresh by the execution reviewer; no process started; incident contained.
