# SB-20260803-211510-candidate-deploy-failed-rollback-uncertain: Monitored candidate deployment failed with rollback outcome uncertain

- **Status:** contained
- **First observed:** 2026-08-03T21:15:10.984102Z
- **Last observed:** 2026-08-03T22:39:42.9914692Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Preview Cloudflare Worker; approved outside-sandbox Windows controller using normal saved Wrangler authentication
- **Version/commit:** controller head `8793f88a36718446c012e207aabd82dfd2ef056e`; candidate `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`; known rollback `94b881051c24903e977428a5f0ce9befd3722839`

## Symptom

The single authorized controller passed its preconditions, then reported candidate_deploy_failed and ended with rollback_outcome_uncertain.

## Impact

The candidate was not accepted and rollback was not verified. All further provider mutations stopped; current preview state requires a separate read-only determination before any recovery decision.

## Reproduction conditions

Run the exact monitored controller after fresh baseline schedule confirmation.
The preconditions pass, the candidate upload command fails, and the controller
cannot verify its automatic rollback path.

## Safe evidence

The bounded final controller result reported
`candidate_preconditions_passed=true`, `candidate_accepted=false`,
`candidate_failure_category=candidate_deploy_failed`,
`failure_category=rollback_outcome_uncertain`, `rolled_back=false`, and
`rollback_verified=false`. A response-discarding read-only follow-up proved the
active deployment shape is exact, the active deployment did not change during
the run, neither the candidate nor the attempted rollback is active, the exact
health contract passes, and normal preview bindings are intact.

## Attempts and outcomes

1. The one authorized controller passed authentication, baseline attribution,
   health, binding, and fresh schedule preconditions.
2. The candidate upload failed; automatic rollback verification also failed.
   The controller stopped and no retry or manual mutation was attempted.
3. A read-only provider/health probe discarded all payloads and proved the
   original healthy active deployment remained unchanged.
4. The exact candidate and rollback Wrangler dry runs failed only inside the
   restricted sandbox but the exact candidate dry run succeeded outside it.
5. A response-discarding `whoami` probe proved authentication is usable and
   Workers write permission is represented.
6. Read-only resource checks proved the configured R2 bucket exists with the
   exact active binding, the configured queue exists, and Vision is already
   associated with that queue.
7. An explicit config check proved neither candidate nor active state contains
   a Workers AI binding; separate Workers AI access succeeds, so AI is not the
   blocker.
8. A tolerant, response-discarding versions query proved zero candidate,
   rollback, or other Worker versions were created during the failed run. The
   failure therefore occurred before version creation, not during traffic
   promotion.

## Cause classification

- **Confirmed cause:** The controller intentionally discards Wrangler's raw
  deployment output and currently preserves only a nonzero exit, so the exact
  provider rejection is not recoverable from this run.
- **Hypotheses:** A provider-side upload validation or transient upload failure;
  strict inherited-binding resolution remains possible but unconfirmed.
- **Rejected hypotheses:** Expired authentication; missing Workers write
  permission; a locally invalid artifact or command; an overlength deployment
  tag; missing configured R2 or Queue resources; a Queue consumer conflict;
  Workers AI enablement or binding drift; failure during traffic promotion;
  the candidate replaced the active deployment.
- **Known exclusions:** No active deployment change occurred. The candidate and
  attempted rollback are not active; health and normal preview bindings pass;
  the freshly confirmed two baseline schedules therefore remained attached to
  the unchanged deployment. No key or secret was changed.

## Correction and prevention

- **Correction:** Add a bounded, privacy-safe Wrangler deployment-failure
  classifier to the controller before any new live attempt.
- **Prevention:** Preserve an allowlisted provider error code/category while
  continuing to discard provider payloads, identifiers, credentials, URLs, and
  raw logs; verify the classifier with tests before requesting another
  provider mutation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Obtain separate explicit authorization for one
  classifier-enabled monitored candidate deployment outside the restricted
  sandbox with automatic rollback; no live retry is currently authorized.

## Verification and related work

Containment is verified: the active deployment is the same healthy build that
served traffic before this run, with exact health and normal binding contracts.
Cloudflare documents a 100-byte version-tag limit and strict inherited-binding
resolution; the controller's generated tag is below that limit, while strict
inheritance remains only a hypothesis until a safe error category is retained.

## Recurrence history

- 2026-08-03T21:15:10.984102Z: First observed.
- 2026-08-03T21:25:23.6971358Z: Read-only attribution proved the preview stayed
  on its original healthy deployment; incident contained without a retry.
- 2026-08-03T21:39:36.4134641Z: Resource and versions probes ruled out R2,
  Queue, Workers AI, and post-upload promotion failures. Exact provider upload
  rejection remains unavailable because raw diagnostics were deliberately
  discarded; safe classifier implementation is the next step.
- 2026-08-03T21:57:41.4296046Z: Privacy-safe candidate and rollback failure
  classification passed functional fake-Wrangler RED/GREEN, bounded-log,
  privacy, repeated cleanup, and complete controller-suite verification. A new
  live attempt remains separately gated.
- 2026-08-03T22:39:42.9914692Z: Exact direct and automatic rollback JSON
  boundaries, separate stream windows, bounded raw-log non-persistence, shared
  leaf sanitization, all local suites, and independent re-review passed with no
  findings. One new monitored live attempt remains separately gated.
