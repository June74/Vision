# SB-20260731-151219-task3-controller-two-red: Controller repair remained red in two intended scenarios

- **Status:** closed
- **First observed:** 2026-07-31T15:12:19.4401035Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 final controller review repair
- **Environment:** Shared worktree; complete controller test file
- **Version/commit:** 73191b7 plus unstaged TDD repairs and setback records

## Symptom

The controller file passes 51 of 53 tests. The rollback-reconciliation and
real observer-window scenarios remain red, while candidate workflow timing,
fresh lifecycle deadlines, and nullable/absent no-signal handling are green.

## Impact

Controller production behavior is not yet fully verified against the final
review finding set.

## Reproduction conditions

Run the complete controller test file after the first implementation pass for
workflow-aware deadlines, nullable close evidence, and rollback reconciliation.

## Safe evidence

Only aggregate test counts and two fixed failure categories were reported.
Raw runner output stayed captured. No source, assertion payload, URI,
credential, protected identifier, provider value, runtime stream, argument, or
environment value was emitted.

## Attempts and outcomes

- 51 tests pass.
- Two assigned review scenarios execute and fail normally.
- No provider, Git, or external state changed.

## Cause classification

- **Confirmed cause:** Pending bounded assertion-category diagnosis.
- **Hypotheses:** Reconciliation state transition and real-clock margin logic
  remain incomplete or fixtures still encode the old contract.
- **Rejected hypotheses:** Candidate workflow and nullable no-signal handling
  are no longer red.
- **Known exclusions:** Resolver and restore-owned files are outside this
  diagnosis.

## Correction and prevention

- **Correction:** Classify the two assertion categories independently, then
  make the smallest aligned production/test corrections without weakening the
  final review contracts.
- **Prevention:** Require the complete controller file after each focused fix.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Bounded category-only diagnosis of the two failing
  scenarios.

## Verification and related work

Rollback reconciliation and real observer-window behavior now pass. The
complete controller file is 53/53 GREEN and all integration gates pass.

## Recurrence history

- 2026-07-31T15:12:19.4401035Z: First observed and contained at 51/53.
- 2026-07-31T15:15:05.0868995Z: Rollback reconciliation is now green. The
  isolated real observer-window scenario remains red after a fixture-precision
  hypothesis was disproved; provider timestamp precision is not the cause.
  Further diagnosis must use safe stage/status counters rather than another
  guessed fix.
- 2026-07-31T15:30:50.5669463Z: Closed after safe stage-level diagnosis,
  controller 53/53 GREEN, and complete repository verification.
