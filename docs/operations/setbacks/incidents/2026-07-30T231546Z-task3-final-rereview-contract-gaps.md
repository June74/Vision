# SB-20260730-231546-task3-final-rereview-contract-gaps: Task 3 final re-review found remaining timing and lifecycle gaps

- **Status:** closed
- **First observed:** 2026-07-30T23:15:46.928753Z
- **Last observed:** 2026-07-31T19:47:32.5520638Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final re-review
- **Environment:** Sanitized full-range Task 3 independent re-review
- **Version/commit:** `b1935577c211`; `2bfbc23f13c4`

## Symptom

Final package review found late-duplicate resolution, restore-unlock provenance, and uniqueness-window anchoring behavior that still diverged from the frozen contract.

## Impact

Task 3 remains unaccepted and Task 4 stays paused until the narrow defects are fixed and re-reviewed.

## Reproduction conditions

Review the executable producer-to-observer shell lifecycle, absolute timing
equations, exact observer job set, and restore provenance against the frozen
Task 3 contract.

## Safe evidence

Three independent package-only reviewers converged on the timing, lifecycle,
and report gaps. The workflow reviewer additionally proved the strict pipeline
cannot distinguish intentional producer termination after observer success
from an upstream failure.

## Attempts and outcomes

- The repaired 435-test focused suite and all static gates passed.
- Package review found that several tests still exercised the consumer or
  parser directly instead of the actual producer-to-consumer wrapper.
- Task 4 remains paused pending one narrow TDD repair and full re-review.
- The five-commit security re-review found five additional candidate-lifecycle
  gaps after the full 1,352-test check passed: context/provider timestamp
  parsers are conflated; child/provider waits are not deadline-interruptible;
  two provider reads are not projected to allowlisted fields; maintenance can
  admit future completion metadata; and an accepted-but-throwing candidate
  dispatch lacks reconciliation.
- The parallel specification review independently confirmed the provider
  projection gap and additionally found that zero-terminal uniqueness is not
  settled on the no-signal path, its success deadline is derived from the
  signal rather than the true close, and the exported restore runtime façade
  does not match the frozen interface name/field contract.
- The workflow review independently elevated the timestamp-parser mismatch,
  found millisecond dispatch attribution is incompatible with provider-second
  creation buckets, and found post-signal polling does not preserve the
  originally proven signal state and timestamp.

## Cause classification

- **Confirmed cause:** Successive repairs covered the known boundaries but the
  executable contract still lacked end-to-end tests for distinct timestamp
  grammars, interruptible child deadlines, exact provider projections,
  maintenance completion causality, and uncertain-dispatch reconciliation.
- **Hypotheses:** None.
- **Rejected hypotheses:** These findings are not provider flakiness, missing
  credentials, or sandbox behavior.
- **Known exclusions:** No protected value, provider action, live request,
  external mutation, backup-key rotation, Task 5 behavior, or Task 6 permanent
  adapter was involved.

## Correction and prevention

- **Correction:** Add explicit producer supervision; derive absolute
  no-signal/uniqueness deadlines from admitted runtime facts; require a fresh
  same-commit role closure for restore; poll through the full late-duplicate
  deadline; reject every unexpected non-skipped observer job; enforce the
  maintenance close equation; separate context-instant and provider-metadata
  timestamp parsing; make every child wait deadline-interruptible and reaped;
  project and exact-shape provider reads; enforce maintenance completion
  causality; reconcile uncertain dispatch; settle zero-terminal uniqueness on
  both success and no-signal paths against its true close; align the exported
  restore runtime façade with the frozen contract; model provider-second run
  creation as an interval when comparing millisecond dispatch bounds; preserve
  the exact original signal across all uniqueness polls; and reconcile the
  report inventory.
- **Prevention:** Executable workflow acceptance requires real wrapper tests
  and algebraic deadline/provenance tests in addition to helper and YAML
  structure tests.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Add realistic RED coverage for specialized
  full-job-list resolution, rollback-to-closure deadline separation,
  accepted-then-timeout reconciliation, default observer-port cancellation,
  conservative production uniqueness close, and rollback-settlement ordering;
  implement the combined narrow repair, rerun all gates, and submit a new
  sanitized full-range package to all three reviewers.

## Verification and related work

Pending implementation, full local verification, and independent re-review.

## Recurrence history

- 2026-07-30T23:15:46.928753Z: First observed.
- 2026-07-31T00:04:17.9513330Z: The three-commit re-review confirmed the prior
  gaps closed but found their operational consequences: observer job budgets
  cannot cover two full resolver horizons plus deployment and terminal
  uniqueness; supervisor startup is producer-first; run-list uniqueness is
  single-page; maintenance still carries a noncanonical close field and
  overconstrains provider completion; future action timestamps and one workflow
  stderr path need fail-closed handling; the supervisor CLI entrypoint lacks a
  direct test. A proposed role-to-cleanup rejection was checked against the
  frozen plan and rejected because same-commit role closure to cleanup-only is
  explicitly required.
- 2026-07-31T00:54:13.6655829Z: The four-commit decisive re-review confirmed
  those operational gaps closed and isolated three remaining boundaries:
  maintenance provider metadata needs the full reserved settlement margin and
  cannot succeed before semantic close; provider listener timestamps must use
  one-second precision and cannot be future at detection; downloaded
  role-closure proof must be byte-bounded before decoding. One resolver
  reference also needs the inclusive final-poll exception documented.
- 2026-07-31T01:25:36.8056023Z: The five-commit security re-review validated
  package integrity but found five executable boundaries still missing:
  distinct timestamp grammars, interruptible and reaped child/provider
  deadlines, exact allowlisted projections for all provider reads,
  maintenance completion causality, and reconciliation after uncertain
  candidate dispatch. No live request, provider mutation, protected value, or
  key change occurred.
- 2026-07-31T01:26:41.3413045Z: The parallel five-commit specification review
  independently confirmed the provider-projection gap and identified missing
  no-signal uniqueness settlement, a signal-derived rather than true-close
  uniqueness deadline, and a restore runtime façade mismatch. The frozen
  role-to-cleanup and restore-to-cleanup lifecycle branches were confirmed
  valid.
- 2026-07-31T01:27:30.2503901Z: The workflow review confirmed the timestamp
  grammar defect as a candidate-path blocker, found dispatch attribution does
  not account for provider-second creation buckets, and found later uniqueness
  polls can accept a changed or failed originally proven signal. The provider
  projection gap was independently confirmed a third time.
- 2026-07-31T05:21:42.4439031Z: The fresh ten-commit specification review
  found three blockers. Skipped generic observer jobs collide by name with
  dedicated active jobs for three observer families, so exact attribution
  rejects realistic full job lists. Rollback dispatch and rollback closure
  reuse one deadline, so timely rollback can leave closure stranded. Default
  in-process observer reads do not propagate or settle the controller boundary,
  so a late metadata read can delay mandatory rollback. No package, source,
  provider, or external state changed.
- 2026-07-31T05:24:33.7391174Z: The independent security review confirmed the
  default observer-boundary blocker and found two more. Accepted-then-timeout
  reconciliation reuses the already-exhausted dispatch deadline, allowing an
  accepted candidate to remain unattributed and skip rollback. The production
  two-job observer supplies no conservative true uniqueness-close bound, so
  valid evidence can be rejected before settlement. It found no credential,
  URI, protected-identifier, or backup-deletion capability exposure.
- 2026-07-31T05:26:43.5989902Z: The workflow review independently confirmed
  default observer-boundary propagation, rollback-versus-closure deadline
  separation, and production uniqueness-close defects. It additionally
  requires rollback settlement before closure dispatch unless workflow
  serialization proves that order. No mutation or provider access occurred.
- 2026-07-31T19:47:32.5520638Z: Closed after all timing, reconciliation,
  uniqueness, rollback-order, and lifecycle-contract repairs passed the full
  repository gate and three final independent reviewers returned no blockers.
