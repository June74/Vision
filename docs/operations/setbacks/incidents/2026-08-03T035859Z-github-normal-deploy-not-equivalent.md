# SB-20260803-035859-github-normal-deploy-not-equivalent: Protected GitHub normal deployment was not an equivalent safety path

- **Status:** closed
- **First observed:** 2026-08-03T03:58:59.7885371Z
- **Last observed:** 2026-08-03T03:58:59.7885371Z
- **Phase/task:** Phase B corrected candidate deployment fallback review
- **Environment:** Local review of the tracked preview workflow
- **Version/commit:** Candidate `c1911f8`; preview not redeployed by Codex

## Symptom

The protected GitHub normal-deploy job can deploy the checked-out commit, but
does not perform live post-deploy health, schedule, or binding verification and
does not automatically roll back an ambiguous result.

## Impact

The workflow cannot safely replace the corrected controller for this candidate
retry.

## Safe evidence

Read-only source review found protected preview credentials and predeployment
build checks, but the normal job ends after Wrangler deployment. Provider
verification and rollback are separate acceptance operations.

## Cause classification

- **Confirmed cause:** Normal GitHub deployment and the corrected controller
  have materially different post-dispatch guarantees.
- **Known exclusions:** No workflow was dispatched and no provider state changed.

## Correction and prevention

- **Correction:** Retain the reviewed local controller and use the owner's local
  terminal only as the execution bridge around the broken approval layer.
- **Prevention:** Do not substitute an authenticated deployment path unless its
  attribution, provider verification, and rollback guarantees are equivalent.
- **Owner:** Codex and independent reviewer.

## Verification and related work

Independent review confirmed zero Critical/Important code findings in the local
controller; the non-equivalent GitHub alternative was rejected without dispatch.

## Recurrence history

- 2026-08-03T03:58:59.7885371Z: Evaluated and closed without workflow mutation.
