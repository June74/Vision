# SB-20260726-234212-ai-gateway-budget-workflow-failed: AI Gateway budget workflow failed

- **Status:** investigating
- **First observed:** 2026-07-26T23:42:12Z
- **Last observed:** 2026-07-27T00:18:19Z
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
- The dashboard contains exactly one expected visible Gateway name, but its
  internal link identifier is different from that name.

## Cause classification

- **Confirmed cause:** Two sequential issues were established: the preview
  token lacked Read for lookup, and the operator script incorrectly assumed the
  visible Gateway name was also its provider identifier.
- **Hypotheses:** None for the current lookup failure.
- **Rejected hypotheses:** No application deployment or scheduled-job failure
  occurred.
- **Known exclusions:** No provider-controlled response content or secret was
  captured.

## Correction and prevention

- **Correction:** Configure Read and Edit, list Gateways, select the exact
  approved visible name, and use only its returned identifier for the update.
- **Prevention:** External mutation commands need privacy-safe stage categories,
  not one undifferentiated failure.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Add the name-to-identifier lookup test first, update
  the operator script, and retry the isolated workflow.

## Verification and related work

Pending.

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
