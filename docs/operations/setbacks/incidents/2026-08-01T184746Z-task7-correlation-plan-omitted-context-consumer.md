# SB-20260801-184746-task7-correlation-plan-omitted-context-consumer: Correlation plan omitted a v2 context test consumer

- **Status:** closed
- **First observed:** 2026-08-01T18:47:46.112178Z
- **Last observed:** 2026-08-01T19:14:56.7450266Z
- **Phase/task:** Phase B Task 7 correlation repair Tasks 1 and 2 typecheck
- **Environment:** Local isolated Phase B worktree and canonical typecheck
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

Canonical typecheck found existing Wrangler-routing fixtures still construct v2 contexts without the newly required dispatch-correlation field, but that dependent test file was absent from the approved repair file list.

## Impact

Typecheck remains red and Task 2 re-review is paused. The necessary scope increase is one compile-time test consumer only; no production or live/provider behavior changed.

## Reproduction conditions

Upgrade the canonical context type to require the new field while leaving the
typed Wrangler-routing valid-context fixtures outside the repair file list,
then run canonical typecheck.

## Safe evidence

- The first canonical typecheck reported sixteen diagnostics in one typed test
  consumer.
- A scope amendment added only that test file and no production behavior.
- After fixture correction, canonical typecheck reported zero diagnostics and
  two focused files passed 173 tests after consolidation.
- Final independent review found no scope, ordering, or invalid-case regression.

## Attempts and outcomes

- Confirmed the diagnostics were valid v2 fixtures missing the mandatory field.
- Added the one-file test-only scope amendment.
- Added a shared valid synthetic field in canonical order while preserving all
  intentional invalid/missing cases.
- Reran focused tests, typecheck, and independent full-diff review.

## Cause classification

- **Confirmed cause:** The original plan enumerated the direct context test but
  omitted a typed downstream test consumer of the upgraded public union.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** Making the mandatory field optional was neither
  necessary nor consistent with the approved contract.
- **Known exclusions:** No production, provider, network, secret, calendar,
  database, R2, deployment, workflow, backup-key, staging, or commit state
  changed through the scope correction.

## Correction and prevention

- **Correction:** Add the typed test consumer as a test-only scope amendment and
  update every valid fixture in canonical order.
- **Prevention:** Before freezing a public type-shape plan, run a compile-time
  consumer inventory and include all typed fixtures, not only direct unit tests.
- **Owner:** Codex.
- **Next diagnostic step:** None; the compile consumer is covered by the final
  repair scope and Gate 0.

## Verification and related work

Closed by zero-diagnostic canonical typecheck, 173 focused passing tests, and a
fresh independent review with zero findings at every severity.

## Recurrence history

- 2026-08-01T18:47:46.112178Z: First observed.
