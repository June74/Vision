# SB-20260811-175437-role-probe-candidate-attribution-failed

- Incident ID: `SB-20260811-175437-role-probe-candidate-attribution-failed`
- First observed: `2026-08-11T17:54:37Z`
- Last observed: `2026-08-11T17:54:37Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance
- Environment: Windows PowerShell, phase-b-foundation linked worktree, GitHub Actions preview workflow
- Version/commit: `5320fa1`

## Symptom

The controller reached `observer_ready`, then failed closed before candidate
attribution and before a candidate-intent artifact was available.

## Impact

The role-probe observer and candidate workflow were cancelled while the
candidate was still in the verification job. The deploy job was skipped; no
candidate deployment, rollback, restore, database mutation, secret mutation, or
calendar mutation occurred.

## Evidence

- The observer workflow had a successful selection/admission and an active
  `Capture role_probe signal` listener.
- The candidate workflow had a successful selection/admission and was running
  `Verify preview candidate`.
- The candidate-intent artifact was absent and the deploy job was skipped.
- The controller emitted `observer_ready` followed by `failed_closed`.
- The controller unit suite passed all 73 tests through the explicit local
  Vitest executable.

## Cause classification

- **Confirmed cause:** the post-observer controller boundary failed before
  candidate attribution; the candidate workflow had not reached deployment.
- **Hypothesis:** candidate dispatch correlation or candidate-intent attribution
  exceeded the controller/driver boundary while application checks were still
  running.
- **Rejected hypotheses:** restore-secret presence, observer concurrency, a
  Cloudflare deployment rejection, Neon restore activity, and application
  runtime behavior; none was reached by this attempt.

## Correction and prevention

Cancel any unmonitored candidate before deployment when the controller fails.
Keep candidate-intent attribution mandatory, preserve automatic rollback, and
diagnose the driver/controller boundary using aggregate workflow timing before
making another live attempt.

## Next step

Trace the live candidate dispatch and reconciliation call path against the
controller's tested timeout contract. Identify whether the driver returned no
mapping, the candidate-intent verifier timed out, or the controller received a
bounded child failure, then make one minimal, test-first correction if needed.

## Verification

The cancelled candidate had no candidate-intent artifact and a skipped deploy
job at cleanup time. No protected provider output was recorded.
