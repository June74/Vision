# SB-20260730-182847-plan-self-check-wording-mismatch: Plan self-check expected noncanonical wording

- **Status:** closed
- **First observed:** 2026-07-30T18:28:47.667028Z
- **Last observed:** 2026-07-30T18:29:01.6004342Z
- **Phase/task:** Phase B live-acceptance closure final plan review
- **Environment:** Local Phase B linked worktree, PowerShell
- **Version/commit:** `c8879b2`

## Symptom

A local structural assertion reported the restore action-time attestation as absent even though the reviewed requirement was present with equivalent wording.

## Impact

The verification sequence paused for diagnosis; no source, provider, credential, or external state changed.

## Reproduction conditions

Run the structural check with the literal regex
`Any ambiguity stops without dispatch` against the Task 8 text, where a line
break separates `Any` from `ambiguity`.

## Safe evidence

- The composite structural check returned `false` only for the restore
  action-time-attestation assertion.
- Separate checks proved the immediate-dispatch, single-attempt, and
  branch-plus-marker requirements were present.
- A bounded follow-up check showed the literal words were separated only by
  Markdown whitespace.

## Attempts and outcomes

1. Split the composite assertion into four privacy-safe Boolean checks.
2. Confirmed three passed and the literal `Any ambiguity` check alone failed.
3. Replaced the line-layout-sensitive phrase with a whitespace-tolerant
   `Any\s+ambiguity` assertion.

## Cause classification

- **Confirmed cause:** The validation regex assumed one literal space where
  Markdown wrapping inserted a newline and indentation.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The plan omitted the fresh restore admission gate;
  bounded inspection proved the requirement is present.
- **Known exclusions:** No product code, provider state, credential, or private
  value was involved.

## Correction and prevention

- **Correction:** Match semantically stable tokens and tolerate Markdown
  whitespace between adjacent words.
- **Prevention:** Structural plan checks must use whitespace-tolerant patterns
  for prose and exact matches only for code identifiers.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; rerun the corrected structural check.

## Verification and related work

The corrected four-part action-time-attestation check passed, allowing the
frozen-plan verification sequence to resume.

## Recurrence history

- 2026-07-30T18:28:47.667028Z: First observed.
- 2026-07-30T18:29:01.6004342Z: Closed after a whitespace-tolerant bounded
  assertion proved the requirement present.
