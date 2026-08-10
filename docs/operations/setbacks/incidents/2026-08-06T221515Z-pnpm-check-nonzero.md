# SB-20260806-221515-pnpm-check-nonzero: Bounded full local check returned nonzero

- **Status:** closed
- **First observed:** 2026-08-06T22:15:15.5645832Z
- **Last observed:** 2026-08-06T22:35:32.3387883Z
- **Area:** Phase B local full-check verification
- **Impact:** The native bounded wrapper completed `pnpm check`, which returned
  a nonzero exit. The wrapper retained only output lengths and did not emit raw
  diagnostics. No provider, deployment, credential, key, or tracked source
  action ran.

## Evidence

The bounded process first returned `CheckExitCode=1` with nonzero
stdout/stderr lengths. Stage isolation identified the unit cleanup contract at
`tests/security/temporary-surface-cleanup.test.ts:1355`; four required
privacy-safe cost-review anchors had been reworded out of the pre-cleanup
contract.

## Cause classification

- **Confirmed cause:** Documentation wording drift in
  `docs/operations/cost-review.md` broke the cleanup-contract anchor matcher.
- **Hypotheses:** None.
- **Rejected hypotheses:** No provider or live deployment failure was involved.

## Correction and prevention

- Restored the exact required anchors without changing the cost policy or
  exposing any provider value.
- Reran the focused cleanup contract and the full bounded `pnpm check`.

## Owner and next step

- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the focused cleanup contract and full
  `pnpm check` both exit zero.

## Verification

The focused cleanup contract exited zero. The full native bounded check exited
zero after the documentation repair; no provider-facing process ran.

## Recurrence history

- 2026-08-06T22:35:32.3387883Z: Closed after documentation anchors were
  restored and the full local check passed.
