# SB-20260803-004737-corrected-redeploy-review-gaps: Corrected redeploy review found two live-state gaps

- **Status:** closed
- **First observed:** 2026-08-03T00:47:37.2786625Z
- **Last observed:** 2026-08-03T01:15:35.0880595Z
- **Phase/task:** Phase B OAuth reconnect Task 5 corrected candidate retry
- **Environment:** Read-only independent review of ignored operational helpers
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

The independent re-review returned zero Critical and two Important findings:
deploy mode did not revalidate the normal baseline in the same execution, and
the controller synthesized schedules from the local artifact instead of
querying the live provider inventory.

## Impact

Candidate redeployment remains blocked. A stale temporary binding, changed
health response, missing cron, or residual one-minute cron could otherwise
escape the predeploy gate. No deployment or provider mutation occurred.

## Safe evidence

The reviewer separately confirmed exact health shape, deployment-window and
single-active-version attribution, automatic rollback after post-dispatch
ambiguity, safe argument splatting and failure categories, full tracked LF
proof, and the correctness of blocking on either missing permanent AI secret.
No provider identifiers, values, or raw responses were retained.

## Cause classification

- **Confirmed causes:** The ignored controller treated its standalone rollback
  validation as if it were bound to a later deploy execution, and converted
  artifact crons into a synthetic provider response.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Health, version attribution, LF recreation, and AI
  binding mismatch classification are not the review gaps.
- **Known exclusions:** Candidate and rollback tracked commits are unchanged.

## Correction and prevention

- **Correction:** Recheck health/bindings immediately inside deploy mode and
  require independent live schedule evidence before and after deployment.
- **Prevention:** Never label artifact-derived state as a live provider query;
  bind every deployment to fresh external evidence or fail closed.
- **Owner:** Codex and independent reviewer.
- **Next diagnostic step:** Implement the same-execution baseline check and use
  the protected GitHub preview environment or a user-visible Cloudflare
  dashboard observation for live schedules without extracting credentials.

## Verification and related work

The first two gaps were repaired with same-execution baseline validation and
nonce-bound browser-visible schedule evidence. A subsequent review found that
the post-dispatch version could still be confused with a concurrent deployment.
The controller now re-reads the proved baseline immediately before dispatch,
requires its ID and both timestamps to remain unchanged, deploys with `--strict`
and a unique one-use tag/message, and accepts candidate or rollback versions only
when both annotations match exactly. The correlation contract test was observed
failing before the repair and passing afterward. The independent final
re-review returned zero Critical and zero Important findings. No deployment
occurred.

## Recurrence history

- 2026-08-03T00:47:37.2786625Z: First observed and contained before deployment.
- 2026-08-03T01:11:49.6361294Z: Concurrent-deployment attribution gap repaired
  with a final baseline recheck, strict deploy, and one-use annotation binding;
  independent re-review requested.
- 2026-08-03T01:15:35.0880595Z: Independent re-review returned 0 Critical and
  0 Important; incident closed.
