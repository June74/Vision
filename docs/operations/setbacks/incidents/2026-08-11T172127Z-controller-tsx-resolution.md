# SB-20260811-172127-controller-tsx-resolution

- Incident ID: `SB-20260811-172127-controller-tsx-resolution`
- First observed: `2026-08-11T17:21:27Z`
- Last observed: `2026-08-11T17:21:27Z`
- Status: `contained`
- Phase/task: Phase B role-probe acceptance preparation
- Environment: Windows PowerShell, phase-b-foundation linked worktree
- Version/commit: `1e98044`

## Symptom

The first monitored acceptance-controller launch through `pnpm.cmd exec tsx`
failed because the shell could not resolve the `tsx` executable.

## Impact

The controller exited before reading the provider driver. No workflow dispatch,
deployment, secret, database, key, calendar, or provider state changed.

## Cause classification

- **Confirmed cause:** this Windows shell requires the project-local explicit
  `tsx.cmd` executable for this invocation; the `pnpm exec` lookup did not
  resolve it.
- **Rejected hypotheses:** this was not a GitHub, Cloudflare, Neon, or restore
  failure.

## Correction and prevention

Use the exact project-local `node_modules\\.bin\\tsx.cmd` path for this bounded
controller invocation and keep the driver arguments unchanged.

## Next step

Retry the role-probe controller through the explicit local binary.

## Verification

The failed launch produced no external request or mutation.
