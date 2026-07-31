# SB-20260731-034743-task3-controller-full-file-regression: Full controller test file remained red after deadline fixes

- **Status:** closed
- **First observed:** 2026-07-31T03:47:43.2423911Z
- **Last observed:** 2026-07-31T04:20:06.3651997Z
- **Phase/task:** Phase B Task 3 isolated controller integration verification
- **Environment:** Isolated controller-hardening worktree; captured Vitest run
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

The three deadline/termination tests pass cleanly, but the complete controller
test file still exits nonzero with five failure markers and zero unhandled
markers.

## Impact

Task 3 integration and commit remain blocked. No source edit followed the
result, and no provider, network, browser, Git history, or external state
changed.

## Reproduction conditions

Run the complete controller unit test file after the final deadline
test-harness corrections.

## Safe evidence

The captured classifier returned only a nonzero exit, five failure markers,
zero parsed passes, and zero unhandled markers. The test stream was not
emitted.

## Attempts and outcomes

- The focused three-case deadline group is fully green.
- The complete file was captured rather than printed.
- A structured rerun identified six failures: three timing/order checks, one
  remote-tip recheck, one accepted-then-throw reconciliation, and one
  no-signal settlement check. Four are AssertionError; two reporter messages
  did not expose a parseable error type.
- No production or test edit followed the classification.
- A count-free source trace confirmed the remote-tip case fails on mock-call
  cardinality, not return value or dispatch outcome, but a neutral fixture name
  was insufficient to classify the extra call's role. The scout stopped
  without editing.
- The second source trace confirmed two production regressions and one stale
  assertion. Expiry recovery reuses an exhausted pre-signal deadline instead
  of a bounded cleanup deadline. The no-signal loop attempts another observer
  read at the cutoff instead of entering rollback/settlement. Reconciled
  dispatch correctly passes the new boundary, while its attribution assertion
  expects the old one-argument shape.
- After the compiler-only fixture corrections, the structured full-file run
  reported the prior six cases plus the adapter constant-error case. That test
  now reaches the boundary-aware adapter instead of calling it with a missing
  argument; its boundary fixture requires classification.
- After the four stale-fixture corrections and three production
  deadline-transition fixes, the structured full-file run improved to
  thirty-eight passes and three failures: delayed uniqueness plus the
  post-signal rollback-child and real-child termination cases.
- Stabilizing the delayed signal timestamp and advancing the rollback fake
  timer through the new inclusive execution allowance did not change the same
  three-failure set. The run still has zero unhandled markers.

## Cause classification

- **Confirmed cause:** Production required a bounded post-attribution cleanup
  deadline, a pre-read no-signal cutoff transition, and an exclusive
  one-millisecond execution allowance after the inclusive rollback semantic
  boundary. The remaining failures were stale boundary-shape assertions,
  unstable signal timestamps, a missing reconciliation fixture, an overflowing
  adapter-test deadline, and one non-unique fixture edit that leaked fake-timer
  state into the following child test.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The three deadline/termination cases and unhandled
  rejection cleanup are not the remaining failure.
- **Known exclusions:** Live, provider, network, browser, deployment, Git
  history, and protected-data state are unaffected.

## Correction and prevention

- **Correction:** Use a structured reporter to return only failing test names
  and error categories, then diagnose each independently before editing.
- **Prevention:** Focused hardening tests must be followed by the full owned
  file before integration.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The complete controller file passed all forty-one tests with zero failures and
zero unhandled markers. Direct source and test compilers both passed with zero
diagnostics.

## Recurrence history

- 2026-07-31T03:47:43.2423911Z: First observed.
- 2026-07-31T03:48:39.3032765Z: Structured classification found six failing
  interaction cases across remote-tip, rollback timing/order, expiry,
  uncertain dispatch, and no-signal settlement; no edit followed.
- 2026-07-31T03:57:22.7459514Z: The remote-tip failure was narrowed to
  call-cardinality, but the scout stopped when its neutral fixture name could
  not establish the extra call role.
- 2026-07-31T03:59:01.8377261Z: Count-free source tracing confirmed expiry and
  no-signal production regressions plus a stale reconciled-dispatch assertion.
- 2026-07-31T04:01:49.6608037Z: The post-type-fix full file reported seven
  failures; the new adapter constant-error case now exercises its required
  boundary argument and awaits fixture classification.
- 2026-07-31T04:08:12.2883117Z: The corrected full file improved to
  thirty-eight passes and three remaining delayed-uniqueness/deadline failures.
- 2026-07-31T04:10:15.3587125Z: The first targeted fixture adjustments left
  the same three failures with zero unhandled markers.
- 2026-07-31T04:20:06.3651997Z: Closed after the complete controller file
  passed forty-one tests, both compilers passed, and no unhandled marker
  remained.
