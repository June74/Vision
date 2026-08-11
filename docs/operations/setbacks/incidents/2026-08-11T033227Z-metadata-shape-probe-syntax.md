# SB-20260811-033227-metadata-shape-probe-syntax

- Incident ID: `SB-20260811-033227-metadata-shape-probe-syntax`
- First observed: `2026-08-11T03:32:27Z`
- Last observed: `2026-08-11T03:32:27Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance diagnosis
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `9bb4db2`

## Symptom

A read-only metadata-shape wrapper failed to parse because its PowerShell
script-scope variable syntax was malformed. The command was rejected before
any child process or provider request started.

## Impact

The probe returned no new evidence. No deployment, version, traffic, rollback,
secret, key, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** the wrapper used `$script$variable` instead of the
  valid `$script:variable` form.
- **Rejected hypotheses:** Wrangler and Cloudflare were not reached, so this
  failure says nothing about the active artifact or its schedule.

## Correction and prevention

Keep the shape probe bounded and use a simpler local variable structure, or
skip it when the existing safe list/view probes already answer the question.
PowerShell wrappers must be syntax-checked before being used as evidence.

## Next step

Use a corrected, minimal read-only shape scan only if it adds information that
cannot be obtained from the repository configuration and validated probes.

## Verification

The parser failure was contained before process creation; no retry has been
run yet.
