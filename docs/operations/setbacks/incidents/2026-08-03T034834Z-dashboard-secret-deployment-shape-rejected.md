# SB-20260803-034834-dashboard-secret-deployment-shape-rejected: Secret-save deployment failed the Wrangler-only baseline shape gate

- **Status:** closed
- **First observed:** 2026-08-03T03:48:34.2455373Z
- **Last observed:** 2026-08-03T04:08:31.5638225Z
- **Phase/task:** Phase B corrected candidate deployment baseline validation
- **Environment:** Preview Cloudflare Worker after owner secret entry
- **Version/commit:** Candidate `c1911f8`; preview not redeployed by Codex

## Symptom

The read-only controller stopped at `active_deployment_shape_invalid`
immediately after the dashboard saved and deployed the two secrets.

## Impact

The binding validator did not run and the candidate did not deploy.

## Safe evidence

The controller emitted only the fixed failure category. No active version ID,
account identifier, binding value, or raw provider metadata was exposed.

## Cause classification

- **Confirmed cause:** The baseline reader combines single-active-version shape
  with a Wrangler-only source requirement, although a legitimate owner secret
  save creates provider state outside the candidate deployment command.
- **Known exclusions:** The controller did not reach candidate dispatch.

## Correction and prevention

- **Correction:** Permit any well-formed source for baseline validation, but
  enforce Wrangler source plus exact one-use tag/message for candidate and
  rollback acceptance.
- **Prevention:** Scope provenance requirements to the operation being
  attributed, rather than applying candidate provenance to owner-created
  baseline state.
- **Owner:** Codex and independent reviewer.
- **Next diagnostic step:** Add a failing source-scope contract test, repair the
  controller, and rerun the read-only baseline gate.

## Verification and related work

The source-scope contract test was observed failing before the repair and
passing afterward. The existing deployment-correlation test also passes, and
the independent review returned zero Critical and zero Important findings.
An owner-run fresh baseline passed the repaired active-deployment and schedule
gates, then stopped later at the separate provider-binding contract. This
proves the source-scope repair in the live path; incident closed.

## Recurrence history

- 2026-08-03T03:48:34.2455373Z: First observed and contained before deployment.
- 2026-08-03T03:52:50.7008062Z: Test-driven repair and independent 0 Critical,
  0 Important review completed; live validation remains pending.
- 2026-08-03T04:08:31.5638225Z: Live owner-run validation advanced through the
  source gate to the provider-binding gate; incident closed.
