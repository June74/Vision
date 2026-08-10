# SB-20260810-225011-phase-b-preflight-probe-boundary

- Incident ID: `SB-20260810-225011-phase-b-preflight-probe-boundary`
- First observed: `2026-08-10T22:50:11Z`
- Last observed: `2026-08-10T22:50:11Z`
- Status: `contained`
- Phase/task: Phase B live-acceptance preflight
- Environment: Windows PowerShell, repository parent and restricted network sandbox
- Version/commit: `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`

## Symptom

The first read-only preflight batch used the repository parent as the Wrangler
working directory, where the local `wrangler.cmd` path does not exist. The same
batch attempted to call the public preview health endpoint from the restricted
sandbox and received a local connection failure before any response.

## Impact

That batch produced no valid deployment or health evidence. No application,
Cloudflare, database, calendar, credential, key, or traffic state changed.

## Evidence

- Wrangler probe: local command-not-found from the wrong working directory.
- Health probe: local inability to connect; no HTTP response body was obtained.
- Branch and artifact inspection remained local and read-only.

## Attempts and outcomes

1. Ran the combined preflight from the repository parent. The Wrangler path was
   invalid for that directory, and the sandbox blocked the health request.
2. Stopped using those results as evidence and prepared corrected bounded
   probes from the active Phase B worktree.

## Cause classification

- **Confirmed cause:** The probe used an incorrect local working directory for
  the Wrangler binary, and the default execution sandbox blocks this external
  health request.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The errors do not indicate a Wrangler, Worker, or
  Cloudflare failure.
- **Known exclusions:** No provider command reached Cloudflare and no traffic
  mutation was attempted.

## Correction and prevention

- Use the active linked worktree for local Wrangler commands.
- Use the approved external-network path for read-only preview health checks.
- Treat command-not-found and local connection failures as invalid evidence.

## Owner and next diagnostic step

- Owner: Vision Phase B release operator.
- Next step: rerun the corrected read-only preflight, then stop before any
  traffic-changing deploy unless separately authorized.

## Related verification

- The exact candidate worktree has already passed typecheck, unit, contract,
  worker, documentation, and production-build checks.
