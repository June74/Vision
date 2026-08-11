# SB-20260811-032823-versions-view-process-start

- Incident ID: `SB-20260811-032823-versions-view-process-start`
- First observed: `2026-08-11T03:28:23Z`
- Last observed: `2026-08-11T03:28:23Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance diagnosis
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `62b0ddf`

## Symptom

A read-only attempt to inspect one deployed version's metadata with the
Wrangler `versions view` command failed before the child process started. The
host reported an invalid process-start directory (OS error 267).

## Impact

The probe produced no provider response and no version or deployment state was
changed. No candidate, traffic, rollback, secret, key, database, or calendar
mutation ran.

## Cause classification

- **Confirmed cause:** the local probe invocation supplied an invalid process
  start configuration, so the operating system rejected it before Wrangler
  could run.
- **Hypothesis:** the wrapper's command/work-directory interpolation produced
  the invalid directory; this has not been isolated to one argument yet.
- **Rejected hypotheses:** Cloudflare resource state and deployment acceptance
  were not exercised by this failed local process start, so neither can be
  inferred as the cause.

## Correction and prevention

Do not use this probe result as evidence about the live Worker. Prefer the
already-validated bounded deployments-list and versions-list probes, and use a
minimal explicit working directory and argument array if version-detail
inspection is still required. Keep provider output reduced to safe shape
booleans/counts.

## Next step

Verify the active schedule/configuration through a safer read-only path before
starting another observer or candidate attempt. The exact live schedule state
remains unconfirmed.

## Verification

The command was contained at process creation; no retry has been run yet.
