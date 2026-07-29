# SB-20260729-173234-task6-cleanup-permanence-token: Cleanup permanence test guessed display labels

- **Status:** closed
- **First observed:** 2026-07-29T17:32:12Z
- **Last observed:** 2026-07-29T18:15:08Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 review fixes
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `fa650ad`

## Symptom

The first cleanup GREEN run failed because a new permanence assertion searched
for `print safe tail`, while the retained test's exact suite label is
`print-safe-tail`.

## Impact

One cleanup test failed. No provider, database, browser, runtime, or external
state changed.

## Reproduction conditions and safe evidence

The permanent file exists and exercises the safe-tail executable. The mismatch
was only the assertion's guessed display text. A follow-up read-only inspection
also confirmed the credential ledger heading is `Credential and key change
log`, not the shorter guessed label.

## Attempts and outcomes

- The first default cleanup run passed the 48-path inventory and representative
  active-residue meta-test.
- The permanence test stopped at the first inaccurate display-label assertion.
- Exact source headings and suite names were inspected before correction.

## Cause classification

- **Confirmed cause:** The new test asserted paraphrased labels instead of
  stable exact source identifiers.
- **Hypotheses:** None.
- **Known exclusions:** The permanent safe-tail test and credential history
  were not missing.

## Correction and prevention

- **Correction:** Assert the exact `describe("print-safe-tail"` suite marker
  and exact credential-ledger heading.
- **Prevention:** Use exact identifiers already present in retained files for
  permanence checks.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The default cleanup suite will be rerun after correcting the two test tokens.

## Recurrence history

- 2026-07-29T18:15:08Z: The final re-review RED test asserted `eight
  temporary selectors` across a Markdown line break. The detector regressions
  for the three permanent false positives and exact shared inventory failed as
  intended, but this prose precondition failed before exercising the missing
  simple-reference classification. The correction is to assert stable
  fragments on each side of the line wrap.
