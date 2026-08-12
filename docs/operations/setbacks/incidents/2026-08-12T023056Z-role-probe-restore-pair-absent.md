# SB-20260812-023056-role-probe-restore-pair-absent

- Incident ID: `SB-20260812-023056-role-probe-restore-pair-absent`
- First observed: `2026-08-12T02:20:17Z`
- Last observed: `2026-08-12T02:30:56Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance after approved temporary-secret deletion
- Environment: GitHub Actions preview acceptance workflow, Cloudflare preview Worker
- Version/commit: `ad6e3c7121bfaf48593fb68fb70fd890a9a7e9c0`

## Symptom

The fresh `role_probe` candidate workflow passed its observer and application
checks, then failed at `Verify live preview is normal before candidate
deployment`. The safe failure stage was the temporary restore-pair provider
state validator. The controller returned `failed_closed`.

## Impact

The candidate stopped before building/uploading its candidate intent and before
any preview mutation. The remaining read-only observer was cancelled after the
candidate failure. The normal preview remained healthy with its permanent
schedule and binding contract. No secret value, backup key, database,
calendar, or application data was changed.

## Cause classification

- **Confirmed cause:** `role_probe` explicitly selects
  `--verify-restore-pair-provider-state`, whose contract requires the exact two
  temporary restore secret bindings. The owner had just deleted those bindings,
  and the read-only provider check confirmed both temporary-name presence flags
  were false.
- **Not a provider outage:** the same read-only check reported healthy normal
  runtime, exactly two permanent schedules, and the normal binding inventory.
- **Not a deployment failure:** the candidate workflow failed before its deploy
  step and produced no new candidate-intent artifact.
- **Rejected hypothesis:** the stale GitHub artifact was not the current
  blocker; the approved cleanup left zero non-expired candidate-intent
  artifacts before this run.

## Correction and prevention

Choose the acceptance family before removing temporary surfaces. To run
`role_probe`, the owner must recreate the two temporary restore secrets through
the Cloudflare dashboard without sharing their values here. If the restore-pair
acceptance is no longer needed, run `foundation_probe` instead; it uses the
normal provider contract and does not require temporary restore secrets. Do
not weaken the validator or recreate secrets automatically.

## Next step

Owner choice is required: recreate the temporary restore pair for `role_probe`,
or authorize switching the next monitored attempt to `foundation_probe` and
leave the restore acceptance explicitly pending.

## Verification

Read-only workflow inspection confirmed the candidate failure job and the
absence of a candidate-intent artifact. The observer was cancelled after its
candidate and rollback jobs were verified not to have mutated provider state.

