# SB-20260730-192457-context-kind-type-widened: Canonical context kind widened during typecheck

- **Status:** closed
- **First observed:** 2026-07-30T19:24:57.655279Z
- **Last observed:** 2026-07-30T19:28:27.7515238Z
- **Phase/task:** Phase B live-acceptance closure Task 1 type validation
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `44d8e93802ce834fd0c8ca620d81472e23431b00`

## Symptom

TypeScript rejected canonical context returns because the validated kind property widened to string and the switch was not considered exhaustive.

## Impact

Type validation stopped before documentation verification; runtime tests remained green and no provider or external state changed.

## Reproduction conditions

Run the required project typecheck after the canonical context runtime tests
were green.

## Safe evidence

TypeScript reported only local discriminated-union return errors and one
missing exhaustiveness return. No private value was rendered.

## Attempts and outcomes

- Preserved runtime validation and narrowed the admitted operation before the
  switch.
- Constructed each returned variant with the switch-narrowed literal and added
  an explicit fail-closed terminal throw.
- Reran the complete project and test typecheck.

## Cause classification

- **Confirmed cause:** The shared base object retained the pre-narrowed string
  property instead of the switch-narrowed operation literal.
- **Hypotheses:** None.
- **Rejected hypotheses:** The closed context grammar and runtime parser were
  not invalid; their focused tests remained green.
- **Known exclusions:** No provider, database, network, or external state was
  involved.

## Correction and prevention

- **Correction:** Preserve the narrowed discriminant explicitly in every
  canonical variant return.
- **Prevention:** Run type validation immediately after adding a closed
  discriminated union, before documentation generation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm.cmd typecheck` exited zero after the correction.

## Recurrence history

- 2026-07-30T19:24:57.655279Z: First observed.
- 2026-07-30T19:25:31.6673927Z: The corrected narrowing passed the complete
  source and test typecheck.
- 2026-07-30T19:28:27.7515238Z: The focused runtime retry showed that the
  type-narrowing correction had moved `kind` after `reviewedCommit` in
  serialized objects. Canonical byte-identity checks rejected all 11 valid
  round trips. The correction preserves the narrowed literal while restoring
  the explicit `version`, `kind`, `reviewedCommit` construction order.
