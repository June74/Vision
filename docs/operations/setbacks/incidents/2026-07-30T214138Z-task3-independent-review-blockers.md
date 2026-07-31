# SB-20260730-214138-task3-independent-review-blockers: Task 3 independent review found live-wiring blockers

- **Status:** contained
- **First observed:** 2026-07-30T21:41:38.165014Z
- **Last observed:** 2026-07-30T21:41:38.165014Z
- **Phase/task:** Phase B live-acceptance closure Task 3 independent review
- **Environment:** Local Phase B worktree; sanitized independent review package
- **Version/commit:** `38bed3e991d5bfb40b1452bd955634e30247c045`

## Symptom

Independent reviewers found that several new Task 3 helpers are not correctly wired into the executable workflow and controller lifecycle.

## Impact

Task 3 cannot pass its acceptance gate; Task 4 is paused while the implementation is corrected and fully re-reviewed.

## Reproduction conditions

Exercise the executable preview workflow, observer CLI, acceptance controller,
production restore dependency factory, and restore-pair lifecycle rather than
only their isolated helpers.

## Safe evidence

Three independent reviewers converged on the same disconnected-live-path
failures without running a provider, deployment, database, object-storage,
queue, browser, network, or remote mutation.

## Attempts and outcomes

- The Task 3 focused suite and static gates passed before review.
- Review proved that passing helper tests did not establish executable workflow
  reachability or correct provider-shaped job handling.
- Task 4 remains paused; the original Task 3 implementer is assigned one
  consolidated TDD repair pass.

## Cause classification

- **Confirmed cause:** Task 3 connected new safety helpers incompletely. The
  executable CLI, workflow, controller, production restore factory, provider
  validator, and restore lifecycle retained legacy or placeholder behavior.
- **Hypotheses:** None.
- **Rejected hypotheses:** The failures are not provider flakiness or missing
  credentials; they reproduce from tracked code and workflow structure.
- **Known exclusions:** No protected value, live provider action, external
  mutation, or Task 5/6 scope expansion caused the defects.

## Correction and prevention

- **Correction:** Wire the executable paths to the reviewed helpers; correct
  observer topology, lifecycle ordering, deadlines, restore production
  composition, provider validation, and privacy boundaries; then re-run the
  complete focused and structural suite.
- **Prevention:** Require provider-shaped executable-path tests for workflow
  safety code. A passing isolated helper test cannot satisfy a live-wiring
  acceptance clause.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete the consolidated Task 3 repair and submit
  a new full-range sanitized review package to all three review specialties.

## Verification and related work

Pending implementation, full local verification, and independent re-review.

## Recurrence history

- 2026-07-30T21:41:38.165014Z: First observed.
