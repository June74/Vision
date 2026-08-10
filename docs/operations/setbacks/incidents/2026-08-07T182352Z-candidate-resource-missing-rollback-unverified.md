# SB-20260807-182352-candidate-resource-missing-rollback-unverified: Classifier-enabled candidate resource missing and rollback was not verified

- **Status:** contained
- **First observed:** 2026-08-07T18:23:52.925961Z
- **Last observed:** 2026-08-10T01:37:22.0622358Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree, preview Cloudflare account
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The fresh baseline evidence was accepted, but the bounded candidate deploy
returned the allowlisted `candidate_deploy_resource_missing` category. The
automatic rollback path returned `resource_missing`, so the controller
reported `rollback_outcome_uncertain` and did not claim acceptance. A second
freshly authorized run after the owner confirmed deployment access reproduced
the same safe categories.

## Impact

The single approved attempt ended without a candidate acceptance or a verified
rollback. No second deploy, manual rollback, schedule edit, binding edit,
secret edit, key rotation, database action, calendar action, or raw provider
output exposure occurred. Provider state was reconciled only through
read-only checks.

## Reproduction conditions

Run the approved classifier-enabled candidate controller after a fresh baseline
schedule confirmation and valid nonce-bound evidence, then observe the safe
candidate and rollback categories.

## Safe evidence

The local candidate and rollback artifacts, their generated configuration, the
R2 bucket and Queue references, and their Wrangler launchers were all present.
Read-only deployment and version listings each decoded successfully and showed
zero candidate-marker and rollback-marker rows. The existing preview health
contract returned HTTP 200 with the exact safe body. No identifiers, payloads,
credentials, URLs, or secrets were recorded.

The owner then performed a fresh read-only dashboard check: no failed
deployment row was present, the Queue binding pair matched, and the R2 binding
pair matched. This further narrows the rejection to a pre-version provider
operation or an API-side validation detail not surfaced in the Worker
Deployments view.

The account-level Audit Logs view also contained no failed attempt for the
run. This leaves no provider-side activity record to identify, so the next
diagnostic target is the local Wrangler failure classification and request
stage rather than another deployment retry.

The classifier-fingerprinted retry then recorded only the safe leaf details:
both candidate and rollback matched `not_found` in the bounded temporary
Wrangler log; neither stdout nor stderr contained the match. The candidate was
not accepted, rollback remained unverified, and final read-only deployment and
version lists still showed no candidate/rollback markers while preview health
remained healthy. No raw log text was retained.

The local log inspection for the attempt near 20:56 UTC found only the
allowlisted controller envelope: stdout length 442, stderr length 0, and the
same safe failure fields above. The bounded temporary Wrangler log was cleaned
up by design, so the original provider text is not recoverable from the local
files. The root `wrangler.jsonc` preview environment, plus the reviewed
candidate and rollback configurations, contain the exact preview Queue and R2
names already confirmed in the dashboard; a binding-name mismatch is not
supported by the available evidence.

Cloudflare's public status page listed R2 as operational when checked on
2026-08-10. The earlier ENAM R2 availability incident overlapped the candidate
attempt window and remains a credible historical correlation, but it never
proved that this specific bucket was affected.

## Attempts and outcomes

1. Baseline evidence validation passed after the separate local time-order
   setback was corrected.
2. The controller returned `candidate_preconditions_passed: true`,
   `candidate_accepted: false`, `candidate_failure_category:
   candidate_deploy_resource_missing`, `rollback_failure_category:
   resource_missing`, and `rollback_verified: false`.
3. Read-only deployment/version reconciliation found no candidate or rollback
   marker, and the existing preview health endpoint remained exact and healthy.
4. Read-only R2 and Queue listings matched the configured resource names; the
   first R2 JSON probe was command-shape invalid and its response was discarded.
5. The owner confirmed the Wrangler identity's deployment/resource access in
   the Cloudflare dashboard. This reduces the permission-mismatch hypothesis
   but does not independently explain the provider's resource-missing result.
6. A bounded read-only `wrangler whoami --json` probe exited successfully and
   decoded safely. It reported Worker/edit and Queue-related text but no R2
   text; this is only metadata and does not prove or disprove R2 permission.
7. The second fresh baseline-confirmed attempt again returned
   `candidate_deploy_resource_missing` followed by `resource_missing` during
   rollback. Read-only reconciliation again found no candidate or rollback
   marker, and preview health remained exact and healthy.
8. The owner clarified the dashboard view: both the preview R2 bucket and
   Queue exist. The earlier generic “binding missing” report therefore did not
   establish a missing binding; no binding mismatch is confirmed.
9. The owner also confirmed that Cloudflare's Deployments/Activity view has no
   failed entry for the latest attempt. This is consistent with rejection
   before a version/deployment record was created.
10. A bounded `wrangler whoami --json` probe exited successfully and decoded,
   but its safe metadata did not expose Workers Scripts Write, Workers Scripts
   Read, or deployment permission names. This is inconclusive; no identity
   values were retained.
11. The owner confirmed the Wrangler user has all privileges. A simple
    permission denial is therefore treated as unlikely; no permission change
    was requested or performed.
12. The root and both artifact-local Wrangler binaries are the same version.
    The candidate artifact's own exact deploy command also passed a compile-only
    dry-run with no stderr. The remaining failure is therefore specific to the
    live provider upload path, not the artifact CLI or local bundle.
13. The current deployed version can be listed and viewed read-only. Its safe
    shape contains metadata/resources and both expected R2 and Queue binding
    names; no version identifier or payload was retained.
14. Owner confirmation of all account privileges does not prove that the
    saved Wrangler OAuth grant contains the same account/scope selection. A
    fresh OAuth authorization is the next non-provider-mutating diagnostic.
15. After reauthentication, read-only `whoami` and version list/detail checks
    again passed, including both expected R2/Queue binding references. The
    OAuth refresh did not change the read-path result; a fresh monitored upload
    is now required to test the live path.
16. The fresh approved monitored attempt again returned
    `candidate_deploy_resource_missing` and `rollback_outcome_uncertain` with
    `rollback_failure_category: resource_missing`, `rolled_back: false`, and
    `rollback_verified: false`. Final read-only reconciliation found ten
    deployment rows and ten version rows with no candidate/rollback markers;
    preview health remained HTTP 200 with the exact safe body.
17. A read-only local log inspection found no raw 404, authentication, network,
    or timeout text: stderr was empty and only the safe controller envelope was
    retained after temporary-log cleanup.
18. The preview Queue and R2 names in the root and reviewed environment
    configurations matched the dashboard names exactly. The root default
    configuration remains local and must not be deployed as a preview
    substitute.
19. Cloudflare status listed R2 as operational on 2026-08-10. The ENAM R2
    availability incident beginning at 18:42 UTC on 2026-08-07 is now historical;
    bucket-specific impact remains unconfirmed.
20. A fourth fresh approved attempt after the R2 resolution accepted fresh
    baseline evidence, then returned `candidate_deploy_resource_missing` with
    `not_found` from the bounded temporary log. Its automatic rollback returned
    `resource_missing`; the safe result was `rollback_outcome_uncertain` with
    `rolled_back: false` and `rollback_verified: false`.
21. The final stdout was 442 bytes and JSON-decodable with empty stderr. No
    candidate or rollback challenge was created, so no version marker appeared
    and no manual retry was performed.

## Cause classification

- **Confirmed cause:** The provider-facing deploy process returned the safe
  `resource_missing` category; the local artifact was not absent, and no
  candidate or rollback version marker appeared afterward. The owner confirms
  that both expected resource types exist, and the preview configuration names
  match them exactly. Cloudflare's public status page recorded an ENAM R2
  availability incident overlapping the attempt window; it is now listed
  operational, but bucket-specific impact was never proven.
- **Hypotheses:** The active R2 incident may have caused a transient binding
  resource lookup failure. A provider-side 404/resource lookup or
  Wrangler/provider deploy-path mismatch remains possible; the raw Wrangler
  text was intentionally not retained, so the exact HTTP response cannot be
  recovered locally. Bucket-specific impact is not yet proven.
- **Rejected hypotheses:** Missing local candidate/rollback folders, a preview
  Queue-name mismatch, a preview R2-name mismatch, and a missing configured
  Queue were disproved by bounded local configuration and read-only checks.
- **Known exclusions:** No candidate or rollback version was observed in the
  reconciled lists; this is not a proof that the controller's rollback contract
  was satisfied, so the incident remains contained.

## Correction and prevention

- **Correction:** Stopped the run, discarded raw provider output, performed
  read-only deployment/version reconciliation, and confirmed the existing
  preview health contract without retrying a mutation.
- **Prevention:** Treat `resource_missing` plus unverified rollback as a hard
  stop. Require a fresh approval and a provider-side deploy-capability or
  resource reconciliation before any future candidate attempt.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** The public R2 incident is resolved/listed
  operational, and one post-resolution retry reached the upload boundary but
  failed with the same pre-version `not_found` result; automatic rollback was
  not verified. Treat this as a hard stop: obtain a Cloudflare-side diagnostic
  or explicitly approved provider-state change before any further mutation. Do
  not use the root default `wrangler deploy --verbose` command because it
  resolves to the local configuration and is not a safe preview test.
- **Refined boundary:** Because no failed deployment entry exists, reconcile
  the saved Wrangler account/context and the Worker version/deploy capability
  before inspecting resource contents again. No account, token, or provider
  setting change is requested.
- **Permission evidence:** The Wrangler identity probe cannot confirm or deny
  the required Worker Scripts Write capability. The owner must inspect the
  same identity's role/permissions read-only; do not rotate or create a token.
- **Updated assessment:** Owner confirmation makes a missing-role explanation
  unlikely. The next check is the existing deployed-version shape and exact
  account/Worker context, still read-only.
- **Artifact boundary:** Root and artifact-local Wrangler versions match, and
  the candidate-local dry-run passes. Do not change the controller or remove
  its tag/message flags without new evidence.
- **Deployed-version evidence:** The existing version is readable in the same
  Wrangler context and contains both expected binding names. Account/Worker
  context remains plausible but the live upload rejection is still unexplained.
- **Next safe action:** Re-authenticate Wrangler interactively for the intended
  account with its default full scope request, then repeat only read-only
  identity/version checks. Do not deploy during that step; a future mutation
  still needs fresh exact approval.
- **Current state:** Reauthentication and the post-checks are complete. The
  next candidate attempt is a separate provider mutation and requires fresh
  exact owner approval.
- **Blocked boundary:** The same pre-version provider rejection has now
  reproduced across four fresh approved attempts, including one after the R2
  incident was listed resolved, despite reauthentication, matching bindings,
  matching Wrangler binaries, successful dry-runs, and full owner privileges.
  Further retries need a new Cloudflare-side diagnostic or an explicitly
  approved provider-state change; no more automatic retries are safe.

## Verification and related work

Read-only deployment and version probes exited zero, decoded successfully, and
reported no candidate or rollback marker; preview health returned the exact
safe contract. The controller itself remains a contained uncertainty and no
completion claim is made.

## Recurrence history

- 2026-08-07T18:23:52.925961Z: First observed.
- 2026-08-07T19:05:25Z: Reproduced on a second fresh approved run after the
  owner confirmed deployment access; the bounded identity probe still showed
  no R2 text, while deployment/version listings and preview health remained
  unchanged.
- 2026-08-07T19:24:56Z: Owner read-only dashboard inspection reported a missing
  Worker binding. The type remains unrecorded; no provider mutation occurred.
- 2026-08-07T19:30:00Z: Owner clarified that both the preview R2 bucket and
  Queue exist. The earlier binding-mismatch hypothesis was rejected; no
  provider state changed.
- 2026-08-07T19:32:39Z: Owner reported no failed deployment entry in the
  dashboard. The provider rejection therefore remains pre-version; no retry or
  provider mutation occurred.
- 2026-08-07T19:35:19Z: Bounded Wrangler identity metadata decoded but exposed
  no permission names, including Worker Scripts Write. This was inconclusive;
  no identity value or provider state was changed.
- 2026-08-07T19:39:59Z: Owner confirmed the Wrangler user has all privileges;
  the permission-mismatch hypothesis was downgraded. No provider state changed.
- 2026-08-07T19:45:13Z: Root and artifact-local Wrangler binaries matched and
  the candidate-local exact deploy dry-run passed with no stderr. The provider
  rejection remains live-upload-specific; no mutation occurred.
- 2026-08-07T19:46:32Z: Read-only current-version list/detail succeeded; safe
  shape included metadata/resources and both expected R2/Queue binding names.
  No identifier or payload was retained and no provider state changed.
- 2026-08-07T19:48:04Z: Owner confirmed all account privileges. The remaining
  hypothesis is a stale/narrow Wrangler OAuth grant or account selection; no
  re-authentication or provider mutation has yet occurred.
- 2026-08-07T19:53:18Z: Owner reauthenticated Wrangler. Post-reauth identity
  and version list/detail checks passed with both R2/Queue references. No
  provider mutation occurred; fresh candidate approval is now required.
- 2026-08-07T20:03:08Z: Third fresh approved candidate attempt reproduced the
  same resource-missing/rollback-uncertain result. Independent deployment,
  version, and health reconciliation remained exact and healthy; no candidate
  or rollback marker appeared and no further retry was started.
- 2026-08-07T22:44:12Z: Local Wrangler output and preview configuration were
  rechecked. Only the safe controller envelope remained; preview Queue/R2
  names matched exactly. Cloudflare status reported an active ENAM R2
  availability incident posted at 18:42 UTC, overlapping the attempt window.
- 2026-08-10T01:22:17.8988704Z: Cloudflare status listed R2 operational. One
  fresh approved retry was launched after that resolution but timed out at the
  baseline schedule checkpoint before any candidate upload; no provider state
  changed.
- 2026-08-10T01:37:22.0622358Z: A fourth fresh approved retry after R2
  resolution accepted fresh baseline evidence but reproduced
  `candidate_deploy_resource_missing`/`rollback_outcome_uncertain` with
  `not_found` signatures, `rolled_back: false`, and `rollback_verified: false`.
  No candidate or rollback marker appeared; no further retry was started.
- 2026-08-10T01:41:14.6090516Z: A bounded read-only Wrangler deployment-list
  reconciliation exited zero and decoded successfully, with ten existing
  records and no candidate or rollback marker. No provider state, deployment,
  credential, or secret value was changed or retained.
- 2026-08-10T03:56:08.4664217Z: Owner manually verified in the Cloudflare
  dashboard that the active deployment exists, both R2/Queue bindings match,
  and both underlying resources exist. No dashboard mutation or redeploy was
  performed. This further narrows the unresolved `not_found` to the provider's
  pre-version upload lookup or its upload-side metadata path.
- 2026-08-10T20:42:05.566Z: The owner reported a separate Claude Code direct
  deployment. A safe read-only Wrangler reconciliation confirmed a new
  API/CLI deployment within 30 minutes and public preview health remained
  HTTP 200 with the exact safe `ok` contract. The reviewed Phase B branch and
  active worktree still contain no corresponding source change, so this does
  not close the earlier controller failure or establish reproducible release
  attribution.
