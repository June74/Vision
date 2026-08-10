# SB-20260803-050814-deployment-baseline-proof-not-submitted: Deployment baseline proof was not submitted during the controller window

- **Status:** closed
- **First observed:** 2026-08-03T05:08:14.0484753Z
- **Last observed:** 2026-08-03T05:18:42.6108879Z
- **Phase/task:** Phase B corrected candidate deployment baseline
- **Environment:** Owner-run local controller and local disposable schedule evidence
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

The authorized `deploy_candidate` run returned
`live_schedule_evidence_timeout` during its pre-deployment baseline wait.

## Impact

The candidate was not deployed because the controller had not yet crossed its
mutation boundary. No rollback, provider mutation, credential change,
calendar change, database change, or key change occurred.

## Safe evidence

After the timeout, the fresh baseline challenge existed while the corresponding
evidence file and all candidate-stage challenge/evidence files were absent.
No nonce, version identifier, URL, or secret was needed for this conclusion.

## Cause classification

- **Confirmed cause:** No baseline evidence file was submitted during the
  controller's bounded wait.
- **Contributing cause:** Operator guidance did not make sufficiently explicit
  that the owner confirmation had to be sent back while the controller was
  still running so Codex could write the correlated proof.
- **Known exclusions:** This was not a schedule mismatch, provider-binding
  failure, deployment failure, or rollback failure.

## Correction and prevention

- **Correction:** Use a monitored rerun: remove stale evidence, start a local
  challenge watcher before the owner launches the controller, and announce the
  exact confirmation moment as soon as a new challenge appears.
- **Prevention:** Never hand off a short-lived interactive proof using only an
  end-of-turn instruction. Establish the watcher and live response channel
  before starting the bounded command.
- **Owner:** Codex.

## Verification and related work

The absence of candidate-stage files proved the first deployment boundary was
not reached. The monitored rerun then detected the new challenge, received a
fresh owner confirmation, and admitted a read-back-verified proof. The
controller advanced past the baseline boundary. A later unbounded deployment
subprocess is tracked separately.

## Recurrence history

- 2026-08-03T05:08:14.0484753Z: First occurrence, safely stopped before
  deployment.
- 2026-08-03T05:18:42.6108879Z: Monitored rerun accepted the fresh baseline
  proof; incident closed.
