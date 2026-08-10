# SB-20260803-004737-wrangler-oauth-direct-read-rejected: Direct Wrangler OAuth profile use was rejected

- **Status:** closed
- **First observed:** 2026-08-03T00:47:37.2786625Z
- **Last observed:** 2026-08-03T00:47:37.2786625Z
- **Phase/task:** Phase B OAuth reconnect Task 5 live schedule verification
- **Environment:** Local privacy-safe schedule-query design
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

A proposed read-only schedule query would have parsed Wrangler's stored OAuth
token and used it directly against the Cloudflare API. The execution boundary
rejected the command as unacceptable credential probing before it ran.

## Impact

No token was read and no provider request started. Schedule verification
remains pending through a safer authenticated boundary.

## Safe evidence

Only the fixed rejection category and reason were retained. No credential,
profile value, account identifier, URL, provider payload, or response was
read or rendered.

## Cause classification

- **Confirmed cause:** The proposed design bypassed Wrangler's supported
  credential handling by directly extracting stored session material.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The rejection does not indicate invalid project or
  Cloudflare state; the command never executed.
- **Known exclusions:** No secret, Worker, workflow, deployment, schedule,
  database, Google state, calendar, or key changed.

## Correction and prevention

- **Correction:** Abandon direct profile parsing. Use the protected GitHub
  preview environment or user-visible dashboard for live schedule evidence.
- **Prevention:** Never extract stored Wrangler OAuth material for ad hoc API
  calls unless the owner separately authorizes that exact credential use.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for the rejected approach.

## Verification and related work

Repository inspection confirmed the existing preview workflow already queries
live schedules through protected environment credentials and validates them
with the exact provider-state contract.

## Recurrence history

- 2026-08-03T00:47:37.2786625Z: Proposed command rejected before execution;
  direct profile use was permanently abandoned.
