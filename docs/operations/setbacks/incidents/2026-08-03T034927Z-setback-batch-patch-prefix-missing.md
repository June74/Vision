# SB-20260803-034927-setback-batch-patch-prefix-missing: Setback batch patch omitted an added-line prefix

- **Status:** closed
- **First observed:** 2026-08-03T03:49:27.7385948Z
- **Last observed:** 2026-08-03T03:49:27.7385948Z
- **Phase/task:** Phase B corrected candidate deployment setback maintenance
- **Environment:** Local documentation patching
- **Version/commit:** Candidate `c1911f8`; preview not redeployed by Codex

## Symptom

A multi-file add patch omitted the `+` prefix on one Markdown continuation line
and was rejected as an invalid hunk.

## Impact

None of the intended incident files or index rows were written by that patch.
No implementation or provider state changed.

## Safe evidence

The patch parser rejected the batch atomically at the malformed line.

## Cause classification

- **Confirmed cause:** One added line lacked the required patch prefix.
- **Known exclusions:** No partial edit occurred.

## Correction and prevention

- **Correction:** Add each incident with an independent, validated patch, then
  update the index separately.
- **Prevention:** Avoid large hand-authored multi-file add patches for setback
  records.
- **Owner:** Codex.

## Verification and related work

The replacement incident files were added individually; incident closed.

## Recurrence history

- 2026-08-03T03:49:27.7385948Z: Observed and closed with independent patches.
