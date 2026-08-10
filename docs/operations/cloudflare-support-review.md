# Cloudflare support review — Vision preview deployment upload

**Prepared:** 2026-08-10 UTC
**Status:** Withdrawn; the original provider-rejection premise is refuted. Keep this document as historical evidence only.

## Correction before any submission

This session did not run `wrangler deploy`. It ran three successful
`wrangler versions upload` calls, which create no-traffic versions but do not
create deployments or move traffic. The uploaded artifact was pinned to
`c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`.

The earlier `candidate_deploy_resource_missing`/`not_found` diagnosis came
from the local failure classifier matching Wrangler's benign `.env file not
found` preamble. It does not establish a Cloudflare resource lookup failure.

One uploaded version was later promoted to 100% traffic at
`2026-08-10T20:37:36Z` by an actor not established by this session. That event
was not a successful deployment from this session. The owner is restoring the
reviewed 2026-08-03 deployment.

## Safe case summary

Historical, superseded summary: Vision's preview Worker upload was believed
to be rejected before Cloudflare created a new version. The controller reported the safe category
`candidate_deploy_resource_missing` with a `not_found` temporary-log
signature. Its automatic rollback path reports
`rollback_outcome_uncertain`/`resource_missing`; no candidate or rollback
version marker appears.

The same pre-version behavior reproduced across four fresh approved attempts.
The latest attempt was made after the Cloudflare status page listed R2 as
operational. Before upload, fresh nonce-bound evidence confirmed the two normal
Cron Triggers. A read-only Wrangler deployment-list reconciliation afterward
decoded successfully and showed ten existing records with no candidate or
rollback marker. Preview health remained HTTP 200 with the safe `ok` contract.

The current evidence instead distinguishes successful version uploads from the
unexercised `wrangler deploy` path. The public health endpoint remains healthy,
but no live acceptance can be claimed from the version uploads alone.

## Expected versus actual

- **Expected:** Upload the reviewed preview Worker, observe a candidate version,
  verify the two normal schedules, then exercise automatic rollback.
- **Actual:** This session invoked `wrangler versions upload` three times and
  each call succeeded. It did not invoke `wrangler deploy`, so trigger
  application and deployment creation remain untested.
- **Impact:** Phase B live deployment acceptance cannot be completed. The
  already deployed preview remains healthy; this is not an outage of the
  current Worker.

## What has already been ruled out

- The preview R2 bucket and Queue exist and match the configured binding names.
- Wrangler was reauthenticated with the normal saved account context.
- The root and artifact-local Wrangler binaries match.
- The candidate-local deploy dry-run passes.
- Existing deployment/version reads succeed.
- The R2 incident was listed operational before the latest retry.
- Owner manually verified in the dashboard that the active deployment exists,
  both R2/Queue bindings match, and both underlying resources exist; no
  dashboard mutation or redeploy was performed.
- Owner further confirmed that no deployment was created on 2026-08-07; the
  last visible deployment was 2026-08-03. The August 7 entry appeared only in
  Audit Logs, so it is not evidence that the candidate Worker version was
  created.

## Submission status

Do not submit the historical case. The provider-side resource-lookup claim is
not supported by the successful version-upload evidence. A future support
request should be based only on a reproducible `wrangler deploy` failure,
after the owner approves that traffic-changing test.

## Do not include

Never include API tokens, OAuth credentials, database URLs, encryption keys,
authorization codes, cookies, email addresses, or raw request bodies. Do not
rotate the preview backup key as part of this review.

## Response to bring back

Return only Cloudflare's diagnosis and any proposed repair scope. Do not send
secrets or raw logs. No deployment retry should be started until the cause is
identified or a separate, explicit provider-state approval is given.
