# SB-20260731-042352-task3-isolated-full-unit-regressions-and-runtime: Isolated full unit run exceeded the interaction limit and found three failures

- **Status:** closed
- **First observed:** 2026-07-31T04:23:52.7927241Z
- **Last observed:** 2026-07-31T05:02:52.0572913Z
- **Phase/task:** Phase B Task 3 isolated controller integration verification
- **Environment:** Isolated controller-hardening worktree; captured full unit project
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

The full unit project ran for more than two minutes, exceeding the
sixty-second commentary interval, and returned three failures outside the
already-green controller file: migration review pinning, workflow environment
separation, and scheduled safe-tail behavior.

## Impact

Controller integration cannot be committed until the three cases are
classified. The user received no progress update during the overlong call. No
provider, network, browser, deployment, Git history, or external state changed.

## Reproduction conditions

Run the entire isolated unit project as one blocking tool call after the
controller file passes, instead of using bounded file groups or a yielded
runner.

## Safe evidence

The captured classifier reported ninety-six files, 1,358 passing assertions,
three failing test names, zero pending assertions, and zero unhandled markers.
No runner stream or failure payload was emitted.

## Attempts and outcomes

- The controller file itself remains green with forty-one tests.
- The full unit project exposed three broader failures.
- No failure payload or source has been inspected yet.

## Cause classification

- **Confirmed cause:** The command scope was too large for one blocking
  interaction. All three failures are isolated-worktree line-ending artifacts:
  every tracked migration and workflow file differs byte-for-byte from the
  main worktree, while every comparison is identical after line-ending
  normalization.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The controller's owned file is not red.
- **Known exclusions:** Live, provider, network, browser, deployment, Git
  history, and protected-data state are unaffected.

## Correction and prevention

- **Correction:** Locate the three exact test files, run each individually with
  captured structured output, and classify isolation artifact versus real
  regression.
- **Prevention:** Use bounded focused groups or a yielded runner for suites
  expected to exceed sixty seconds.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The exact two affected files reproduced the three assertions. Byte-only and
normalized comparisons established line endings as the sole difference. After
integration, the canonical schema/workflow files and the complete repository
gate passed.

## Recurrence history

- 2026-07-31T04:23:52.7927241Z: First observed.
- 2026-07-31T04:27:39.9640386Z: Contained after all three failures were proven
  to be isolated-worktree line-ending artifacts; canonical integration
  verification is the closure condition.
- 2026-07-31T05:02:52.0572913Z: Closed after the canonical focused files and
  complete repository gate passed.
