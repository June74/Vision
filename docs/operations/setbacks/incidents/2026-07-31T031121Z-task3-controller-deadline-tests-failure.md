# SB-20260731-031121-task3-controller-deadline-tests-failure: Task 3 controller deadline tests had two failures and an unhandled error

- **Status:** closed
- **First observed:** 2026-07-31T03:11:21.598212Z
- **Last observed:** 2026-07-31T03:46:42.2666190Z
- **Phase/task:** Phase B Task 3 isolated controller deadline hardening
- **Environment:** Isolated controller-hardening worktree; focused Vitest deadline group
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus controller deadline boundary

## Symptom

The three focused deadline and termination tests produced one pass, two failures, and an unhandled-error warning category after boundary propagation compiled cleanly.

## Impact

Deadline behavior verification paused before further edits; no provider, live, protected, committed, or external state changed.

## Reproduction conditions

Run the three focused never-resolving pre-signal, post-signal/rollback, and real
child timeout/termination tests after the full async dependency boundary
compiles cleanly.

## Safe evidence

The sanitized runner returned one pass, two failures, and one
unhandled-error category. No runner stream, child output, URI, identifier,
protected value, or provider data was emitted.

## Attempts and outcomes

- Deadline and AbortSignal types were propagated through every compiler-forced
  controller dependency/call site.
- Direct TypeScript compilation passed before this focused behavior run.
- One of three deadline cases passed; two plus an unhandled error remain.
- A color-enabled filtered rerun suppressed runner streams, but terminal color
  escapes prevented reliable extraction of the two test names and categories.
  Safe classification found three unhandled-error headings and two
  unhandled-rejection markers without emitting their contents.
- A color-disabled structured rerun identified AssertionError categories in
  the post-signal rollback-deadline case and the real child terminate/reap
  case. The pre-signal case passed, and the structured unhandled-errors field
  contained zero markers.
- Structured failure messages classified the rollback failure as
  identity-equality and the real-child failure as deep-equality, but did not
  expose parseable expected/received sides. No additional rerun or edit was
  performed.
- A source-line-only rerun mapped the rollback assertion to line 1425 and the
  real-child assertion to line 1481. Diagnosis then paused because a separate
  read-only source search exceeded its authorized context window.
- The scoped inspection confirmed the rollback failure is test-only: the
  harness retained a mock object, replaced that same object's implementation,
  and then recursively invoked it for non-rollback dispatches, preventing the
  rollback observation. The child diagnostic classified an ordinary-stderr
  write but could not derive a reliable safe count from the structured diff.
- Replacing that recursive mock implementation did not make the isolated
  rollback test green: it still produced one assertion failure and an
  unhandled-error category. The child probe was not started.
- The next structured inspection mapped the remaining rollback failure to the
  exact deadline-equality assertion at line 1430. Structured unhandled count
  was zero and exposed no unhandled type, so the dot-reporter warning is not
  currently corroborated.
- The deadline comparison confirmed the harness expectation was exactly one
  polling interval early. The contract correctly starts the 50-second local
  rollback window at signal detection, which occurs after the first
  five-second poll, not at controller start.
- After correcting that expectation, the rollback assertion passed, but the
  single-test process still exited nonzero because the dot reporter retained
  an unhandled-error condition. The child probe remained deferred.
- A scoped rerun confirmed exactly one unhandled rejection owned by the test
  harness. Its type remained unknown because the type-only parser did not
  match Vitest's decorated unhandled-section heading.
- The bounded type retry classified the single unhandled rejection as Error
  and confirmed its owner: the test attaches its rejection expectation after
  the controller promise has already rejected. All rollback behavior
  assertions themselves pass.
- The three-case rerun proved all deadline and terminate/reap behavior
  assertions pass. The run remained nonzero only because the pre-signal case
  attaches its rejection expectation after advancing timers, reproducing the
  same test-owned late-handler condition.

## Cause classification

- **Confirmed cause:** All observed failures are test-only. Rollback had a
  mock-recursion defect, an expectation that omitted the signal-detection
  interval, and late rejection-handler attachment. The pre-signal case has the
  same late-handler defect. The real child terminate/reap behavior now passes.
- **Hypotheses:** The child assertion may reflect adapter stream-capture
  behavior, terminate/reap ordering, or its observation boundary. The rollback
  harness may contain a second timing or promise-settlement defect after the
  recursion correction.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Compilation, provider state, live requests, protected
  values, commits, pushes, and external state are unaffected.

## Correction and prevention

- **Correction:** Inspect only the two failing test names and their safe
  assertion/error categories, then isolate and fix each independently.
- **Prevention:** Treat unhandled rejections as a separate failure even when
  the main deadline assertion passes; termination tests must prove reap/settle.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

After the pre-signal handler-order correction, the structured three-case run
exited zero, reported all three tests passed, and contained zero unhandled
markers. Production deadline, cancellation, rollback, terminate, stream
suppression, and reap assertions are green.

## Recurrence history

- 2026-07-31T03:11:21.598212Z: First observed.
- 2026-07-31T03:13:36.4716824Z: The first filtered rerun preserved stream
  suppression but color escapes blocked safe name/category extraction; three
  unhandled-error headings and two unhandled-rejection markers were counted.
- 2026-07-31T03:14:56.0308304Z: A color-disabled structured rerun isolated two
  AssertionError cases, confirmed the pre-signal case green, and reported zero
  structured unhandled markers.
- 2026-07-31T03:16:16.8242514Z: Structured failure messages exposed only
  identity-equality and deep-equality classes, not parseable assertion sides;
  the agent stopped before editing or rerunning.
- 2026-07-31T03:17:35.5576614Z: The two failures mapped to source lines 1425
  and 1481; further diagnosis stopped when a separate source-context search
  exceeded the authorized scope.
- 2026-07-31T03:19:07.3974985Z: Scoped inspection confirmed a test-only mock
  recursion defect for rollback; the child reporter classified ordinary
  stderr but failed to derive a reliable safe write count.
- 2026-07-31T03:20:17.2848496Z: The authorized rollback harness correction
  left its single test red and produced an unhandled-error category; the agent
  stopped before the child probe or further edits.
- 2026-07-31T03:27:05.5154688Z: The remaining rollback failure mapped to its
  exact deadline-equality assertion; structured unhandled count was zero, so
  the prior dot-reporter warning remains uncorroborated.
- 2026-07-31T03:28:31.4929375Z: The deadline was confirmed late by exactly the
  first polling interval because the test measured from controller start
  instead of signal detection; production behavior matches the contract.
- 2026-07-31T03:29:24.0599195Z: The corrected rollback assertion passed, but
  the single-test run still exited nonzero on an unhandled-error condition;
  the agent stopped before the child probe.
- 2026-07-31T03:36:10.9872703Z: Exactly one test-harness-owned unhandled
  rejection was confirmed, but the strict type parser returned unknown because
  it missed Vitest's decorated heading.
- 2026-07-31T03:37:02.9850425Z: The bounded retry classified one Error caused
  by the test's late rejection-handler attachment; rollback behavior
  assertions themselves pass.
- 2026-07-31T03:45:09.0596591Z: All three behavior assertions passed; the only
  remaining nonzero condition is the pre-signal test's late rejection-handler
  attachment.
- 2026-07-31T03:46:42.2666190Z: Closed after the three-case structured rerun
  passed with zero unhandled markers.
