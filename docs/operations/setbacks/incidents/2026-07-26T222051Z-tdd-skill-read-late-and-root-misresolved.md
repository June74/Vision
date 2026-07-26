# SB-20260726-222051-tdd-skill-read-late-and-root-misresolved: TDD skill read late and root misresolved

- **Status:** closed
- **First observed:** 2026-07-26T22:20:51Z
- **Last observed:** 2026-07-26T22:20:51Z
- **Phase/task:** Phase B temporary backup acceptance
- **Environment:** Local Codex workflow
- **Version/commit:** `cab6d4d`

## Symptom

The temporary scheduler behavior change followed a real RED/GREEN sequence, but
the required test-driven-development skill was not read before the sequence.
The first corrective read also combined the wrong skill roots and returned
file-not-found.

## Impact

The implementation evidence itself remains valid because the expected three
tests failed before the minimal change and all thirteen targeted tests passed
afterward. The process contract was nevertheless followed late, and diagnosis
paused for correction.

## Reproduction conditions

Rely on remembered TDD rules instead of opening the cataloged skill, then
combine the `r0` skill root with the `.system` subpath from `r2`.

## Safe evidence

The earlier RED run failed exactly on the daily-to-one-minute schedule
expectations; the GREEN run passed all thirteen targeted tests. The incorrect
skill path returned file-not-found, while the exact `r0` path loaded the full
skill.

## Attempts and outcomes

- The temporary code change had an authentic test-first failure and passing
  minimal implementation.
- The first skill read used an invalid combined root.
- The exact catalog path loaded successfully before any new diagnostic code.

## Cause classification

- **Confirmed cause:** Skill invocation discipline and root mapping were not
  checked before the behavior change.
- **Rejected hypotheses:** The TDD behavior sequence was not tests-after.
- **Known exclusions:** No secret or external provider state was affected by
  the skill-read errors.

## Correction and prevention

- **Correction:** Read the complete TDD skill from the exact `r0` path before
  considering new implementation.
- **Prevention:** Resolve one catalog root literally; do not combine root
  fragments, and read applicable skills before the first test edit.
- **Owner:** Codex.

## Verification and related work

Closed after the complete skill was loaded and its checklist was reconciled
with the already captured RED/GREEN evidence.

## Recurrence history

- 2026-07-26T22:20:51Z: First occurrence.
