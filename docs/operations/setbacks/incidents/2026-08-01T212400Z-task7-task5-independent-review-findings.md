# SB-20260801-212400-task7-task5-independent-review-findings: Task 5 independent review found six contract gaps

- **Status:** closed
- **First observed:** 2026-08-01T21:24:00.9579420Z
- **Last observed:** 2026-08-01T22:36:05.6244377Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 independent review
- **Environment:** Frozen ignored local driver and contained provider-stub self-test
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The fresh read-only review returned zero Critical, six Important, and zero Minor findings. The driver treated zero or invalid correlation matches as a successful null result, private state reads reopened a checked path with nonfatal decoding, journals and mappings persisted keys outside their approved exact schemas, mapping context binding was not compared at resolution, provider identifiers crossed a JavaScript numeric boundary before string validation, and the self-test removed matching temporary roots it did not own.

## Impact

Task 5 is not accepted and Task 6 cannot start. The gaps could weaken fail-closed behavior, permit a private-state path-swap or context substitution, change a large provider identifier, and make concurrent contained tests interfere with each other. No live provider, network, browser, database, calendar, object storage, authentication, credential, deployment, key, secret, staging, commit, or push action occurred.

## Reproduction conditions

Review the frozen Task 5 driver and self-test against the approved implementation and independent-review briefs, especially exact reconciliation failure, private single-handle reads, exact persistent schemas, context-bound resolution, identifier string projection, and current-invocation-only cleanup.

## Safe evidence

The independently reviewed contained suite passed all 38 assertions, but several assertions encoded the wrong contract and omitted the remaining adversarial boundaries. The frozen privacy scan contained no literal URL, email address, or 64-character hexadecimal value. No raw child output, provider identifier, opaque token, digest, path outside the repository, or private value is recorded.

## Attempts and outcomes

- A pre-review correction added four missing boundaries and reached 38 of 38 contained assertions.
- Root reran the frozen self-test successfully and byte-verified the three-file review snapshot.
- Independent review inspected the frozen files and the two named permanent parser modules without executing tests or live/provider commands.
- The final review verdict was FAIL with zero Critical, six Important, and zero Minor findings.
- After repairing those six findings plus two liveness gaps, the fresh five-file repaired-v2 review returned FAIL with zero Critical, two Important, and zero Minor findings. The remaining gaps are test quality only: deadline canaries sample abort state before crossing the former boundary and use an overlong rollback allowance, while the large-identifier stub does not require the exact provider-side string projection.

## Cause classification

- **Confirmed cause:** The self-test asserted permissive null reconciliation and expanded state schemas, and did not cover single-handle state reads, context-hash substitution, exact string preservation for large identifiers, or concurrent-root ownership.
- **Hypotheses:** Focused adversarial RED cases plus minimal ignored-driver changes can enforce exact-one reconciliation, exact state records, single-handle fatal bounded reads, end-to-end context binding, string-only identifier projection, and invocation-owned cleanup.
- **Rejected hypotheses:** The review failure came from real provider behavior or a containment escape; the review was read-only and fully local.
- **Known exclusions:** No tracked production source, workflow, external account, provider state, secret, or backup key changed.

## Correction and prevention

- **Correction:** Verify each finding against the permanent interfaces, add one contained RED category per boundary, make only the minimal ignored driver/self-test corrections, rerun the complete suite and syntax checks, repeat privacy scanning, and require another fresh zero-finding review.
- **Prevention:** Treat tests that bless output or persistence as contract claims; compare them line-by-line with the approved failure and data-minimization requirements before accepting GREEN.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for Task 5; proceed to the separately scoped single-use control task.

## Verification and related work

Closed after focused repair, 57 of 57 contained assertions, 99 of 99 focused tests, clean syntax/type/privacy gates, byte-verified frozen-v3 capture, and a fresh independent verdict of zero Critical, Important, or Minor findings.

## Recurrence history

- 2026-08-01T21:24:00.9579420Z: First recorded after the frozen Task 5 independent review.
- 2026-08-01T22:22:26.6015832Z: The repaired-v2 independent review found two remaining Important test-coverage gaps and no Critical or Minor findings. No production or external state changed.
- 2026-08-01T22:36:05.6244377Z: Closed after repaired-v3 independent review returned PASS with zero findings at every severity.
