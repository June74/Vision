# SB-20260731-035139-task3-controller-test-typecheck-and-classifier: Controller test compiler found diagnostics and the classifier rejected empty output

- **Status:** closed
- **First observed:** 2026-07-31T03:51:39.6305617Z
- **Last observed:** 2026-07-31T04:00:50.7687353Z
- **Phase/task:** Phase B Task 3 isolated controller integration verification
- **Environment:** Isolated controller-hardening worktree; direct local compilers
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

The direct source compiler passed, while the direct test compiler exited with
twelve diagnostics. The count-only wrapper then called its regular-expression
matcher with an empty successful source-output value and emitted a PowerShell
argument exception.

## Impact

Task 3 test type safety is not yet green. The wrapper exception printed local
diagnostic code instead of only safe counts, but no secret, provider value,
protected data, external identifier, or runtime stream was involved.

## Reproduction conditions

Run both direct compilers through a classifier that assumes every captured file
returns a non-null string, even when the successful compiler emits nothing.

## Safe evidence

Source compiler: zero exit. Test compiler: nonzero exit and twelve TypeScript
diagnostic markers. The classifier exception was a local null-input category.

## Attempts and outcomes

- Package-manager verification was retired after its isolated-tree repair
  attempt.
- The repository-local source compiler passed.
- The repository-local test compiler found twelve diagnostics.
- No compiler stream has been inspected or emitted.

## Cause classification

- **Confirmed cause:** The wrapper did not coerce empty capture content to an
  empty string before matching. The twelve diagnostics were test-fixture
  drift: one missing reconciliation seam and eleven direct adapter calls that
  omitted the required deadline/abort boundary.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Production source type safety is not the blocker.
- **Known exclusions:** No package, source, provider, network, browser, Git
  history, or external state changed.

## Correction and prevention

- **Correction:** Parse the captured test compiler output with a null-safe
  category/filename counter and emit no diagnostic text, then repair each
  confirmed type category.
- **Prevention:** Captured-output classifiers must normalize null to an empty
  string before any regular-expression operation.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The null-safe classifier grouped all diagnostics without emitting messages.
After the test-only fixture corrections, the direct source and test compilers
both exited zero with zero diagnostics.

## Recurrence history

- 2026-07-31T03:51:39.6305617Z: First observed.
- 2026-07-31T04:00:50.7687353Z: Closed after null-safe classification,
  test-fixture correction, and zero-diagnostic source/test compiler runs.
