# SB-20260801-183705-task7-correlation-task2-review-findings: Correlation Task 2 review found three controller gaps

- **Status:** closed
- **First observed:** 2026-08-01T18:37:05.792831Z
- **Last observed:** 2026-08-01T19:14:56.7450266Z
- **Phase/task:** Phase B Task 7 correlation repair Task 2 review
- **Environment:** Local isolated Phase B worktree and repository-local Vitest shim
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

Independent review found incomplete draft typing, missing valid-length nonhex coverage, and insufficient public-channel non-emission assertions.

## Impact

Task 2 remains unaccepted and Task 3 is paused. No provider, live, secret, calendar, database, R2, deployment, workflow, or backup-key state changed.

## Reproduction conditions

Review the complete Task 2 controller/test diff, then exercise canonical
typecheck and inspect each negative generator case's public-channel assertions.

## Safe evidence

- First review: zero Critical, three Important, zero Minor findings.
- Root-cause correction: two focused files passed 177 tests and canonical
  typecheck reported zero diagnostics.
- Fresh re-review closed draft typing and malformed-value coverage but retained
  one Important finding because negative cases did not capture standard output,
  standard error, or equivalent log channels.
- Final consolidated review reported zero Critical, zero Important, and zero
  Minor findings after 173 focused tests and zero-diagnostic typecheck.

## Attempts and outcomes

- Corrected builder draft return types and removed completed-context casts.
- Added independent valid-length nonhex and exact fixed-error tests.
- Corrected two invalid test labels and the omitted typed v2 fixture consumer.
- Re-review showed one remaining output-capture evidence gap.
- Added five-channel capture with guaranteed restoration, then removed the
  redundant weaker negative cases so every surviving category uses that proof.

## Cause classification

- **Confirmed cause:** The first repair asserted status, returned state, and
  thrown text but did not install spies for process or equivalent log output.
- **Hypotheses:** None remain for the open finding.
- **Rejected hypotheses:** Draft typing, valid-length nonhex validation, and
  canonical typecheck are no longer failing boundaries.
- **Known exclusions:** No provider, network, secret, calendar, database, R2,
  deployment, workflow, backup-key, staging, or commit state changed.

## Correction and prevention

- **Correction:** Add isolated stream/log capture around every negative
  generator case and include the captured bytes in the non-emission assertion.
- **Prevention:** Public-channel privacy tests must install the spies they claim
  to cover; nearby tests of unrelated child processes do not count.
- **Owner:** Codex.
- **Next diagnostic step:** None; proceed to correlation repair Task 3.

## Verification and related work

Closed after the final full-diff review passed specification and quality with
zero findings at every severity, 173 focused tests passed, and canonical
typecheck reported zero diagnostics.

## Recurrence history

- 2026-08-01T18:37:05.792831Z: First observed.
- 2026-08-01T18:58:09.8182334Z: Fresh re-review reduced the findings to one
  Important output-capture gap. Focused tests and typecheck were green; no
  external or live action occurred.
- 2026-08-01T19:09:22.2739215Z: The next fresh review confirmed the new
  five-channel table is correct but found four redundant earlier negative cases
  outside that proof structure. The correction is test-only consolidation;
  focused tests and typecheck remained green and no external action occurred.
