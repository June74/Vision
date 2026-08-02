# SB-20260801-215907-task7-task5-internal-polling-shorter-than-controller: Driver polling ends before controller workflow budgets

- **Status:** closed
- **First observed:** 2026-08-01T21:59:07.0049023Z
- **Last observed:** 2026-08-01T22:05:35.5224770Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 post-repair inspection
- **Environment:** Ignored local provider driver and tracked acceptance controller
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The controller correctly grants candidate work approximately 31 minutes and rollback work approximately 16 minutes, but the driver's reconciliation loop has an internal production maximum of about 2 minutes. Candidate-intent polling also stops at about 20 minutes. The approved repair requires the controller deadline to be the shorter hard outer stop.

## Impact

A valid delayed workflow could be rejected before its approved operation-specific deadline, recreating the liveness failure the repair is intended to remove. No provider, network, browser, deployment, database, calendar, object storage, authentication flow, credential, secret, key, backup key, stage, commit, or push was accessed or changed.

## Reproduction conditions

Compare the production polling constants in the ignored driver with the candidate and rollback workflow durations in the tracked controller. The driver's fixed internal retry duration must exceed the longest controller allowance while test-only guarded overrides keep contained tests fast.

## Safe evidence

Read-only source inspection showed the relative duration mismatch. Only sanitized duration classes are recorded; no identifier, opaque token, hash, URL, private path, or raw child output is retained.

## Attempts and outcomes

- Root traced both controller deadlines and the driver loop constants.
- The mismatch was confirmed before freezing the repaired snapshot for review.
- The structural RED failed only the two production internal-budget assertions; guarded test overrides remained fast.
- Both production internal cycle counts were minimally raised so their fixed windows exceed the controller's longest outer allowance.
- After GREEN, a read-only timestamp helper used an unsupported PowerShell parameter. The same command's evidence reads still completed, no artifact changed, and closure resumed with the compatible UTC form.

## Cause classification

- **Confirmed cause:** The controller deadline was expanded, but the driver's older fixed cycle counts were not expanded with it.
- **Hypotheses:** None remain for this incident.
- **Rejected hypotheses:** The controller still uses the old default timeout; the tracked code now passes operation-specific deadlines.
- **Known exclusions:** No workflow YAML or permanent context schema change is needed.

## Correction and prevention

- **Correction:** Added structural contained assertions for both internal windows and guarded test overrides, then raised only the two production cycle counts.
- **Prevention:** Whenever an outer deadline changes, assert that every nested polling ceiling is either derived from it or strictly longer.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident; the broader Task 5 snapshot still requires its scheduled independent review.

## Verification and related work

The structural RED completed 54 assertions with 52 passing and only the 2 planned production-duration categories failing. The final complete contained suite passed 54 of 54 assertions, including the fast guarded overrides. Both ignored JavaScript modules passed `node --check`. No workflow, controller, schema, live system, credential, secret, key, backup key, Git state, or external service was accessed or changed.

## Recurrence history

- 2026-08-01T21:59:07.0049023Z: First recorded during post-repair deadline tracing.
- 2026-08-01T22:05:35.5224770Z: Closed after contained RED/GREEN and both syntax checks.
