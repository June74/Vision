# SB-20260812-015926-stale-candidate-lifecycle-gate

- Incident ID: `SB-20260812-015926-stale-candidate-lifecycle-gate`
- First observed: `2026-08-12T01:38:12Z`
- Last observed: `2026-08-12T01:59:26Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance after temporary restore-secret cleanup
- Environment: GitHub Actions preview acceptance workflow, Cloudflare preview Worker, local Task 8 controller state
- Version/commit: `7fa241f433f4d81f4f03ab4b03aeecdceb7fc0c6`

## Symptom

After the owner deleted both temporary restore secrets, a fresh monitored
role-probe attempt reached `observer_ready`, dispatched a candidate and a
rollback, then returned `failed_closed`. The candidate workflow failed at
`Verify latest post-restore closure before candidate deployment`; the rollback
workflow failed at `Verify rollback targets the latest candidate intent`.

## Impact

The fresh attempt did not reach the candidate deployment step, so it did not
create a new preview mutation. The rollback dispatch was conservatively
rejected because there was no candidate-intent artifact for that fresh run.
The live preview remained healthy with the normal schedule and binding shape.
No secret value, backup key, database, calendar, or application data was
changed by these checks.

## Cause classification

- **Confirmed cause:** GitHub contains one non-expired `vision-preview-candidate-intent`
  artifact from an older workflow run whose commit does not match the reviewed
  tip. There is no non-expired `vision-preview-rollback-closed` artifact. The
  older candidate run completed its candidate job successfully. A fresh
  baseline attempt therefore fails the exact latest-candidate check before it
  can upload a new intent, and its defensive rollback has no current intent to
  own.
- **Confirmed normal provider state:** a read-only Cloudflare check after the
  owner's deletion reported healthy runtime, exactly two schedules, expected
  binding shape, and both temporary restore-name presence flags false.
- **Hypothesis rejected:** the deleted temporary secrets are not the current
  blocker; they are absent and the provider contract is healthy.
- **Hypothesis rejected:** the current failure is not a new Cloudflare upload
  or binding lookup failure; the candidate gate failed before the deployment
  step.

## Diagnostic attempts and contained tooling errors

- A bounded GitHub artifact inventory and read-only prior-run inspection
  reproduced the stale artifact and missing closure without exposing payloads or
  identifiers.
- A first PowerShell status loop and a follow-up nested-loop probe were
  malformed and failed before provider access. A probe for a non-existent
  `scripts/run-preview-acceptance-driver.mjs` path also failed before provider
  access. The preferred `rg` executable was unavailable in this environment;
  bounded PowerShell file inspection was used instead.
- The setback helper path named by the local skill (`scripts/new_setback.py`)
  is not present in this checkout, so this incident and index row were created
  with the repository patch workflow. These command errors caused no external
  mutation or data exposure.

## Correction and prevention

Do not relax the latest-candidate or closure guards and do not treat the old
artifact as a baseline. First establish owner-approved disposition for the
older successful candidate artifact: either complete its exact rollback/closure
chain at its reviewed commit, or permanently delete only that obsolete GitHub
Actions artifact after separately verifying the preview is normal. Then freeze
the branch tip, repin the acceptance input, and rerun one fresh monitored
attempt. Add a supported, documented artifact-disposition procedure so a
successful candidate cannot strand the next baseline attempt.

## Next step

The owner must approve one narrow GitHub cleanup action (delete only the stale
`vision-preview-candidate-intent` artifact) or provide the prior closure proof
if it exists elsewhere. No Cloudflare, Neon, secret, key, or application-data
action is needed for this blocker.

## Verification

Read-only checks passed for the normal provider state and proved the stale
artifact/closure asymmetry. The acceptance retry remains intentionally blocked
until the artifact disposition is resolved.

