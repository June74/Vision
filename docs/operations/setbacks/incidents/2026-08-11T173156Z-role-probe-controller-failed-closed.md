# SB-20260811-173156-role-probe-controller-failed-closed

- Incident ID: `SB-20260811-173156-role-probe-controller-failed-closed`
- First observed: `2026-08-11T17:31:56Z`
- Last observed: `2026-08-11T17:40:28Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance
- Environment: Windows PowerShell, phase-b-foundation linked worktree, GitHub Actions observer
- Version/commit: `bd25e12`

## Symptom

The monitored role-probe acceptance controller emitted its fixed
`failed_closed` result before dispatching a candidate.

## Impact

The read-only observer workflow was dispatched and remained in its signal-listener
state. No candidate-intent artifact, candidate deployment, rollback, restore,
database mutation, secret mutation, or calendar mutation was observed.

## Evidence

- The current-commit workflow count was one and its status was `in_progress`.
- The observer job `Capture role_probe signal` was `in_progress`; admission had
  succeeded and candidate/rollback jobs were skipped.
- The observer correlation artifact was present; the candidate-intent artifact
  was absent.
- The local Task 8 mapping inventory contained an `observe` mapping for this
  commit and no `deploy_role_probe` mapping.

## Cause classification

- **Confirmed cause:** the controller failed closed before the candidate-dispatch
  boundary while the observer dispatch itself remained active.
- **Hypothesis:** observer dispatch admission reached the controller's bounded
  deadline while the provider run was still pending, so its correlation artifact
  and local mapping were not available in time.
- **Rejected hypotheses:** missing restore-secret names, Cloudflare deployment
  rejection, Neon restore mutation, and application runtime failure; none was
  reached by this attempt.

## Correction and prevention

Keep the observer and candidate boundaries separate, preserve the fail-closed
resolver, and retry only with a fresh expiry and the final reviewed branch tip.
Before retrying, verify the prior observer has settled or is excluded from the
new dispatch interval, and retain only aggregate workflow evidence.

## Next step

Run one bounded read-only resolver diagnostic against the existing observer. If
it is healthy, allow it to settle, then create a fresh pinned role-probe input
and rerun the approved monitored controller with the explicit local Windows
`tsx.cmd` executable.

## Latest verification

A standalone read-only resolver run against the existing observer returned exit
code zero. This narrows the unresolved hypothesis to the controller's timing or
dispatch boundary rather than a persistent observer metadata contract failure.

## Recurrence

On the fresh pin, the controller failed closed again. The matching workflow was
still `pending` after roughly three minutes, with no selection/correlation
artifact, no candidate-intent artifact, and no local mapping for the new commit.
This is consistent with a provider dispatch queue delay exceeding the observer
dispatch call's bounded window; the run was not yet at application or deployment
execution.

## Verification

The aggregate workflow and local-state checks above were completed without
printing provider identifiers, secrets, tokens, URLs, or protected payloads.
