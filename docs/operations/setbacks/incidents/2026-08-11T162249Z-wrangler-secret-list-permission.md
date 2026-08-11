# SB-20260811-162249-wrangler-secret-list-permission

- Incident ID: `SB-20260811-162249-wrangler-secret-list-permission`
- First observed: `2026-08-11T16:22:49Z`
- Last observed: `2026-08-11T16:22:49Z`
- Status: `contained`
- Phase/task: Phase B encrypted restore-drill preparation
- Environment: Windows PowerShell, phase-b-foundation linked worktree
- Version/commit: `4c7e848`

## Symptom

The read-only Wrangler secret-list probe failed before it could query
Cloudflare. Wrangler could not write its local diagnostic log under the saved
configuration directory and returned a permission error.

## Impact

No secret values, Cloudflare resource, Worker configuration, database, key,
calendar, deployment, or provider state changed. Restore-secret presence
remains unverified by this probe.

## Cause classification

- **Confirmed cause:** local permission failure writing Wrangler's diagnostic log
  file.
- **Rejected hypotheses:** this was not evidence that a secret is missing or
  that Cloudflare rejected the request.

## Correction and prevention

Retry the same read-only command with the normal saved Wrangler authentication
and a writable temporary Wrangler log/config location, while reporting only
secret-name presence. Never print secret values.

## Next step

Run the bounded secret-name probe again. If the two temporary restore names are
still absent, have the owner add them through the Cloudflare dashboard before
the restore candidate is dispatched.

## Verification

The command failed before a provider response was available and no mutation
was attempted.
