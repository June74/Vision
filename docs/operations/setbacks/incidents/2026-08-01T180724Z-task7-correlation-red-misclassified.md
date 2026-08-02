# SB-20260801-180724-task7-correlation-red-misclassified: Correlation repair RED was misclassified

- **Status:** closed
- **First observed:** 2026-08-01T18:07:24.140151Z
- **Last observed:** 2026-08-01T18:09:43.0939845Z
- **Phase/task:** Phase B Task 7 correlation repair Task 1
- **Environment:** Windows PowerShell, isolated Phase B worktree, repository-local Vitest shim
- **Version/commit:** Uncommitted Task 1 repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The implementer labeled a nonzero package-runner failure as the expected contract RED even though Vitest never collected the test file.

## Impact

Production edits were made without valid assertion-level RED evidence. No live/provider or secret-bearing state changed; Task 1 review is paused until a genuine RED-to-GREEN sequence is restored.

## Reproduction conditions

Run the plan's direct package-runner form in this shell, observe executable
resolution fail before collection, and then treat the nonzero exit as if it
were an assertion-level contract failure.

## Safe evidence

- The package-runner output named executable resolution, not a test assertion.
- The repository-local Vitest shim exists.
- After temporarily removing only the premature Task 1 production change, the
  local shim collected 25 tests and produced the intended six failing tests.
- Reapplying the minimal v2 evidence contract changed the same suite to one
  passing file with 25 passing tests.

## Attempts and outcomes

- The first implementer attempt stopped before TDD due to the separate `rg.exe`
  launch issue.
- The retry ran the unresolved package-runner form for both RED and GREEN, then
  incorrectly described the first nonzero result as the expected contract RED.
- Root reproduced the runner failure, verified the local test shim, removed the
  premature production delta with `apply_patch`, captured the real six-test
  RED, reapplied the minimum contract, and captured the 25-test GREEN.

## Cause classification

- **Confirmed cause:** The retry inferred the expected failure category from a
  nonzero process result without proving test collection or reading the safe
  failure category.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The Task 1 assertions were not responsible for the
  package-runner executable-resolution error.
- **Known exclusions:** No provider, network, secret, calendar, database, R2,
  deployment, workflow, backup-key, commit, or staging action occurred.

## Correction and prevention

- **Correction:** Require proof that the intended test file was collected and
  that the expected assertions failed before accepting any TDD RED. Restore the
  sequence through the verified repository-local shim when the package runner
  is unavailable.
- **Prevention:** Every task report must distinguish runner exit, collection,
  failing-test count, and failure category; a nonzero exit alone is never RED
  evidence.
- **Owner:** Codex.
- **Next diagnostic step:** Independent Task 1 spec and quality review.

## Verification and related work

Closed after a genuine assertion-level sequence: 25 tests collected with six
expected failures before implementation, followed by 25 of 25 passing after
the minimal production contract was restored.

## Recurrence history

- 2026-08-01T18:07:24.140151Z: First observed.
