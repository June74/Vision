# SB-20260731-231658-task6-strict-suite-count-assumption: Task 6 strict wrapper assumed one failed suite

- **Status:** closed
- **First observed:** 2026-07-31T23:16:58.7714520Z
- **Last observed:** 2026-07-31T23:18:02.0781844Z
- **Phase/task:** Phase B live-acceptance closure Task 6 strict verification
- **Environment:** Local Phase B worktree under the managed sandbox
- **Version/commit:** Task 6 uncommitted candidate after accepted Tasks 1 through 5

## Symptom

The controller's privacy-safe wrapper converted an expected strict cleanup RED
into an unexpected wrapper failure because it required one failed suite. The
inner run reported the expected three failed tests but grouped them into two
failed suites.

## Impact

Task 6 verification paused before accepting the strict evidence. No project
source, provider state, deployment, credential, backup key, or external state
changed.

## Reproduction conditions

Run the strict cleanup test through a wrapper that validates both the required
three failed assertions and an unsupported one-suite assumption.

## Safe evidence

The inner process exited nonzero and returned only aggregate counts: three
failed tests, two failed suites, and ten passed tests. No test diagnostics,
provider data, secret, URI, environment value, or protected identifier was
printed or recorded.

## Attempts and outcomes

- The first controller wrapper rejected the run because its one-suite check did
  not match Vitest's two-suite grouping.
- A bounded rerun exposed only the three failed test names. They exactly matched
  the reviewed active-operations residue, shared-residue absence, and temporary
  inventory assertions.
- The corrected wrapper required inner exit 1 and exact set equality for those
  three names. It passed with three failed and ten passed tests.

## Cause classification

- **Confirmed cause:** The controller added an unsupported failed-suite-count
  assertion that is not part of Task 6's strict cleanup contract.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The aggregate failed-test count did not indicate an
  extra or missing strict residue assertion.
- **Known exclusions:** This is not evidence of a provider, R2, deployment,
  credential, backup-key, or live-preview failure.

## Correction and prevention

- **Correction:** Inspect only failed test names, then validate the documented
  three expected assertions without imposing a suite-count requirement.
- **Prevention:** Verification wrappers must assert only frozen contract facts;
  runner-specific suite grouping is informational unless the plan requires it.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The bounded JSON-reporter rerun exited 1 with exact reviewed-failure equality,
three failed tests, and ten passed tests. No implementation change was needed.

## Recurrence history

- 2026-07-31T23:16:58.7714520Z: First observed and contained before accepting
  strict evidence.
- 2026-07-31T23:18:02.0781844Z: Closed after the corrected wrapper matched the
  exact three reviewed failures and rejected missing or additional failures.
