# SB-20260801-181803-task7-correlation-task1-review-findings: Correlation Task 1 quality review found two binding gaps

- **Status:** closed
- **First observed:** 2026-08-01T18:18:03.015346Z
- **Last observed:** 2026-08-01T18:27:00.2148018Z
- **Phase/task:** Phase B Task 7 correlation repair Task 1 review
- **Environment:** Local isolated Phase B worktree and repository-local Vitest shim
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

Independent review passed specification scope but found an unnormalized hostile-proxy path and missing evidence-field-isolating regression tests.

## Impact

Task 1 remains unaccepted and Task 2 is paused. No provider, live, secret, calendar, database, R2, deployment, workflow, or backup-key state changed.

## Reproduction conditions

Pass a proxy-backed evidence value whose reflection trap throws, and separately
remove the evidence-field mutations from the trusted-input substitutions in the
initial Task 1 test suite.

## Safe evidence

- The first review reported zero Critical, two Important, and zero Minor
  findings.
- The hostile proxy test failed before the normalization repair because the
  local trap escaped the public assertion boundary.
- Isolated evidence operation, reviewed-commit, digest, and second-context byte
  tests were absent before the repair.
- The repaired focused suite passed 27 of 27 tests.
- A fresh independent full-diff re-review reported zero findings at every
  severity.

## Attempts and outcomes

- Added the hostile-proxy test first and captured the intended reflection RED.
- Added isolated evidence-field and valid-second-context binding regressions.
- Wrapped the complete public assertion path in the existing closed error
  normalization boundary without weakening exact comparisons.
- Reran the focused suite and obtained 27 of 27 passing.
- Refroze the full diff and obtained an independent clean re-review.

## Cause classification

- **Confirmed cause:** The public assertion invoked hostile reflection outside
  its normalizing boundary, and the initial binding tests invalidated trusted
  inputs before reaching three evidence-field comparisons.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The evidence schema and digest algorithm did not
  require redesign.
- **Known exclusions:** No live/provider, network, secret, calendar, database,
  R2, deployment, workflow, backup-key, staging, or commit state changed.

## Correction and prevention

- **Correction:** Normalize the complete assertion boundary and maintain one
  isolated regression per trusted/evidence comparison plus a valid
  second-context byte-binding case.
- **Prevention:** Independent task review must inspect hostile-object control
  flow and prove each security comparison is reached by its own test.
- **Owner:** Codex.
- **Next diagnostic step:** Begin correlation repair Task 2 from the accepted
  Task 1 contract.

## Verification and related work

Closed by a 27-of-27 focused GREEN and a fresh independent full-diff review with
zero Critical, zero Important, and zero Minor findings.

## Recurrence history

- 2026-08-01T18:18:03.015346Z: First observed.
