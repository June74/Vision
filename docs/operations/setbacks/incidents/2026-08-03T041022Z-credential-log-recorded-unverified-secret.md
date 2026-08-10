# SB-20260803-041022-credential-log-recorded-unverified-secret: Credential ledger treated an owner report as a verified secret change

- **Status:** closed
- **First observed:** 2026-08-03T04:10:22.5770599Z
- **Last observed:** 2026-08-03T04:10:22.5770599Z
- **Phase/task:** Phase B preview AI credential audit
- **Environment:** Local credential-change ledger
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

The ledger described both AI secrets as created or replaced after the owner said
the form was done, before exact name/type verification. Later UI inspection
confirmed `OPENAI_GATEWAY_BASE_URL` was absent.

## Impact

The credential ledger temporarily overstated the confirmed external state. No
secret value or provider identifier was recorded.

## Safe evidence

The owner reported the exact missing binding name. The controller had already
failed closed with `provider_binding_contract_invalid`.

## Cause classification

- **Confirmed cause:** An owner completion report was recorded as a completed
  credential change instead of a pending assertion.
- **Known exclusions:** No candidate deployment or key rotation occurred.

## Correction and prevention

- **Correction:** Reword the API-key row as owner-reported/pending verification
  and record the Gateway row as an intended but absent change.
- **Prevention:** Credential ledgers must distinguish reported action from
  independently verified name/type state.
- **Owner:** Codex.

## Verification and related work

The ledger now states the exact epistemic status without values; incident closed.

## Recurrence history

- 2026-08-03T04:10:22.5770599Z: Found and corrected before deployment.
