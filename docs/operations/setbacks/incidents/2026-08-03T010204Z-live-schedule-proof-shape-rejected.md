# SB-20260803-010204-live-schedule-proof-shape-rejected: Fresh schedule proof was rejected as malformed

- **Status:** closed
- **First observed:** 2026-08-03T01:02:04Z
- **Last observed:** 2026-08-03T01:06:17.5780306Z
- **Phase/task:** Phase B corrected redeployment live schedule proof
- **Environment:** Local corrected redeploy controller against preview
- **Version/commit:** Candidate `c1911f8`; live preview still on rollback

## Symptom

The controller returned `live_schedule_evidence_shape_invalid` after receiving
a freshly observed, nonce-bound baseline schedule proof.

## Impact

Baseline validation stopped before the binding gate and before deployment. The
candidate was not deployed, and no provider state changed.

## Reproduction conditions

Issue a fresh baseline challenge, inspect the live Cloudflare Trigger events
panel after issuance, write the exact two cron expressions with the challenge
nonce and issuance timestamp, and let the controller read the proof.

## Safe evidence

The browser found exactly the approved fifteen-minute and daily cron schedules
and no one-minute cron. The controller emitted only the safe failure category.
No URL, identifier, credential value, or provider log was exposed.

## Attempts and outcomes

- The fresh proof was written only after the live browser observation.
- The controller rejected it at its shape predicate and exited before any
  deployment command.

## Cause classification

- **Confirmed cause:** Baseline validation passed a zero-second wait. Adding a
  one-use nonce made the controller read the previous proof once and fail at
  the deadline before the fresh proof could be supplied.
- **Rejected hypotheses:** Boolean-only diagnostics showed every intended
  eight-field shape predicate passes for the fresh proof.
- **Known exclusions:** The live schedule values and challenge freshness were
  correct; no candidate dispatch occurred.

## Correction and prevention

- **Correction:** Give both baseline validation paths the same bounded
  180-second proof window used for post-deployment observations, then replay
  with a new challenge.
- **Prevention:** Add a local parser contract check for a valid nonce-bound proof
  before using the validator as a deployment gate.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Parse the controller, replay with a new one-use
  challenge, and verify it advances to the known binding gate.

## Verification and related work

A new challenge was issued, the dashboard was refreshed after issuance, and a
fresh nonce-bound proof with exactly the approved two schedules passed. The
controller then stopped at the expected `provider_binding_contract_invalid`
gate because the two approved preview AI secrets are still absent. No
deployment occurred, and the local Wrangler debug log remained absent.

## Recurrence history

- 2026-08-03T01:02:04Z: First observed and contained before deployment.
- 2026-08-03T01:03:43.5062542Z: Confirmed as a zero-wait orchestration defect;
  the bounded baseline wait was added for verification.
- 2026-08-03T01:06:17.5780306Z: Fresh replay advanced to the known binding
  gate; incident closed with no deployment.
