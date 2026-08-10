# SB-20260803-214917-wrangler-classifier-propagation-false-green: Classifier suite passed without exercising live deploy result propagation

- **Status:** closed
- **First observed:** 2026-08-03T21:49:17.673226Z
- **Last observed:** 2026-08-03T22:39:42.9914692Z
- **Phase/task:** Phase B privacy-safe deployment classifier
- **Environment:** Ignored Phase B PowerShell deployment controller and local fake-Wrangler contract tests
- **Version/commit:** controller package based on `8793f88a36718446c012e207aabd82dfd2ef056e`; no tracked change

## Symptom

Independent review found that Invoke-NativeSilently still returned only ExitCode, so Invoke-ArtifactDeploy could not pass WranglerFailureCategory to candidate or rollback code despite the new suite reporting GREEN.

## Impact

No provider or product state changed, but the operational classifier was not ready for a live retry and the reported propagation coverage was inaccurate.

## Reproduction conditions

Test `Get-WranglerFailureCategory` directly and assert only source markers for
candidate/rollback propagation while leaving `Invoke-ArtifactDeploy` routed
through the int-only `Invoke-NativeSilently` helper.

## Safe evidence

Source inspection showed `Invoke-NativeSilently` returned only `ExitCode`. The
new functional fake-Wrangler test then produced the genuine sanitized RED
category `functional_deploy_result_is_int`.

## Attempts and outcomes

1. The initial direct classifier tests passed but did not exercise the deploy
   boundary.
2. Independent review rejected that GREEN.
3. A functional fake artifact invoked `Invoke-ArtifactDeploy` and failed RED
   because its result was an integer.
4. Only `Invoke-ArtifactDeploy` was rewired to the classified bounded result;
   existing silent callers remained int-only.
5. Functional deploy and rollback propagation tests, privacy checks, focused
   classifier tests, and the full controller suite passed.

## Cause classification

- **Confirmed cause:** The initial suite verified the classifier in isolation
  and used static propagation markers instead of executing the live deploy
  helper boundary.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The classifier result was already preserved by
  `Invoke-NativeSilently`.
- **Known exclusions:** No provider, network, product, tracked Git, credential,
  key, secret, schedule, or backup-key action occurred.

## Correction and prevention

- **Correction:** Add a functional fake-Wrangler artifact test and return the
  bounded classified object from `Invoke-ArtifactDeploy` only.
- **Prevention:** Every operational propagation claim must cross the actual
  caller/callee boundary; source-marker tests may supplement but never replace
  a functional boundary test.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected focused test returned
`wrangler_failure_classifier_contract_ok`. Independent verification also passed
three cleanup runs and the complete 13-check suite with
`corrected_redeploy_native_suite_ok`. Returned deploy objects contain only
`ExitCode`, blank `StandardOutput`, and an allowlisted category.

Final verification added exact copied-controller JSON boundary tests for both
`rollback_only` and candidate failure followed by automatic rollback failure,
plus a shared final-leaf sanitizer. Independent re-review found no remaining
issues and passed the parser, behavior harness, focused classifier,
cleanup-deadline, and complete native suite.

## Recurrence history

- 2026-08-03T21:49:17.673226Z: First observed.
- 2026-08-03T21:57:41.4296046Z: Functional RED/GREEN and independent suite
  verification completed; incident closed.
- 2026-08-03T22:01:13.1427102Z: Final independent review found that direct
  `rollback_only` failure still retained the classifier leaf only in script
  state, while the top-level output and operator allowlist omitted it. The
  incident is reopened as contained; no provider or product state changed.
- 2026-08-03T22:06:23.8070228Z: Recurred when the follow-up RED checkpoint
  tested only for two function names and one source marker rather than
  executing the required output, cleanup-fault, and interleaved-stream
  behaviors. Root rejected the structural sentinel before implementation;
  no external or tracked state changed.
- 2026-08-03T22:08:36.1275646Z: Recurred when the replacement stream harness
  treated absence of a parameter-binding exception as PASS but did not assert
  the returned classification. PowerShell ignored the intended stream
  semantics, so root rejected the false pass and required an exact
  `authentication_failed` result. No external or tracked state changed.
- 2026-08-03T22:16:19.0934943Z: Recurred when the focused suite required an
  obsolete direct-deletion source pattern after cleanup moved behind a bounded
  helper. The parser passed, but the marker-only assertion failed before
  behavior ran. The suite must replace it with executable cleanup contracts;
  no external or tracked state changed.
- 2026-08-03T22:21:09.8976426Z: Final re-review found that the executable
  harness covered top-level `rollback_only` but not the automatic candidate
  rollback/catch/JSON path, and accepted any non-null direct-rollback leaf.
  Current source remained allowlisted and all local suites passed, but root
  withheld live readiness until exact boundary values are asserted and the
  final sanitizer is shared. No external or tracked state changed.
- 2026-08-03T22:33:44.4293891Z: The first exact top-level harness produced a
  false RED because PowerShell evaluated the mocked call's Wrangler path
  argument before invoking the mock, while the isolated fixture omitted that
  harmless local file. Safe field-only diagnostics confirmed both scenarios
  stopped at the authentication stage. The fixture is being corrected before
  any controller change; no external or tracked state changed.
- 2026-08-03T22:39:42.9914692Z: Corrected isolated fixture, exact top-level
  assertions, shared sanitizer, all local suites, and final independent
  re-review passed with no findings; incident closed.
