# SB-20260726-234212-ai-gateway-budget-workflow-failed: AI Gateway budget workflow failed

- **Status:** closed
- **First observed:** 2026-07-26T23:42:12Z
- **Last observed:** 2026-07-27T01:33:23Z
- **Phase/task:** Phase B AI Gateway configuration
- **Environment:** Guarded GitHub preview operator workflow
- **Version/commit:** `0cd841a`

## Symptom

The one-shot Gateway job failed during its apply-and-verify step after setup and
dependency installation succeeded.

## Impact

The $9.50 provider-side cap is not yet accepted. Deployment, safe-tail, and
normal preview verification jobs were disabled for this workflow mode.

## Reproduction conditions

Dispatch the preview workflow with only `configure_ai_budget=true` for commit
`0cd841a`.

## Safe evidence

The isolated Gateway job failed at its single provider action. The command
emitted no Cloudflare response body, identifier, credential, or URL.

## Attempts and outcomes

- All local tests and the complete repository gate passed.
- The live provider action failed closed.
- The current CLI maps every failure to one generic message, which is
  insufficient to distinguish lookup, permission/update, and returned-rule
  verification stages.
- A fresh retry with the closed classifier returned only `lookup_failed`;
  no update request was attempted.
- A status-refined retry returned `lookup_unauthorized`.
- The preview deployment token was updated with account-level AI Gateway Edit,
  but a fresh lookup still returned `lookup_unauthorized`. The list operation
  requires the separate Read permission before the Edit-protected update can
  run.
- Adding Read moved the safe category to `lookup_not_found`.
- The dashboard contains exactly one expected visible Gateway label. An initial
  route-suffix check incorrectly treated its deeper subpage path as proof that
  the internal identifier differed.
- The name-to-identifier lookup retry still returned `lookup_not_found`.
- A conservative exact ID-or-name lookup also returned `lookup_not_found`.
- The refined classifier returned `lookup_empty`.
- An attempted secret correction used the wrong clipboard surface; the next
  isolated run failed earlier with `invalid_configuration`.
- After the secret was corrected, the API still returned `lookup_empty`.
- Rechecking the stored dashboard link proved that `vision-preview` was the
  Worker, not an AI Gateway.
- The approved AI Gateway was then created exactly once. The next isolated run
  passed lookup and moved to the safe category `update_failed`.
- The status-refined retry returned `update_unauthorized`.
- The owner saved the exact rule through the Gateway dashboard. The guarded
  workflow then verified it read-only and skipped the denied update.

## Cause classification

- **Confirmed cause:** The preview token initially lacked Read, and the intended
  AI Gateway did not yet exist. A Worker with the same visible name was
  mistakenly treated as proof that it did. Those lookup blockers are corrected.
- **Confirmed cause:** The current preview token is rejected at the AI Gateway
  write-protected update operation.
- **Rejected hypotheses:** No application deployment or scheduled-job failure
  occurred.
- **Known exclusions:** No provider-controlled response content or secret was
  captured.

## Correction and prevention

- **Correction:** Configure Read and Edit, then compare the signed-in Gateway
  account with the deployed Worker account using only a boolean equality check
  before changing the lookup contract again.
- **Prevention:** External mutation commands need privacy-safe stage categories,
  not one undifferentiated failure.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None. Preserve the read-only idempotent acceptance
  path and keep provider mutations confined to explicit operator approval.

## Verification and related work

Guarded workflow run `30230011441` passed the exact global rule verification.
Deployment, safe-tail, and normal preview verification jobs remained skipped.

## Recurrence history

- 2026-07-26T23:42:12Z: First observed.
- 2026-07-26T23:46:20Z: Recurred with safe category `lookup_failed`; the next
  retry distinguishes authorization from not-found without reading provider
  content.
- 2026-07-27T00:13:05Z: Two status-refined retries returned
  `lookup_unauthorized`, including after Edit was added. The correction is to
  include the separate Read permission required by the lookup stage.
- 2026-07-27T00:18:19Z: Read authorization succeeded and the category moved to
  `lookup_not_found`. Dashboard evidence confirmed that the expected visible
  name exists under a different internal identifier.
- 2026-07-27T00:27:16Z: The name-based retry also returned
  `lookup_not_found`. The prior route-suffix inference was rejected because the
  route continued to a normal Gateway subpage after the expected segment.
- 2026-07-27T00:35:45Z: The exact ID-or-name retry still returned
  `lookup_not_found`; the next closed classifier distinguishes an empty account
  from a nonempty identity mismatch.
- 2026-07-27T00:43:57Z: The classifier returned `lookup_empty`. A clipboard
  bridge used for the account correction selected unrelated host clipboard
  content, and the next run safely stopped at `invalid_configuration`.
- 2026-07-27T01:01:16Z: The corrected account continued to return
  `lookup_empty`. The dashboard route was rechecked and established that the
  visible `vision-preview` resource was the Worker, not a Gateway.
- 2026-07-27T01:08:27Z: The approved Gateway was created. Lookup then succeeded
  and the safe category moved to `update_failed`.
- 2026-07-27T01:15:59Z: The refined category was `update_unauthorized`. Direct
  navigation to the saved Gateway dashboard route was then blocked by browser
  policy and was not bypassed.
- 2026-07-27T01:33:23Z: The dashboard-saved rule passed the read-only guarded
  workflow. The incident is closed without broadening token write access.
