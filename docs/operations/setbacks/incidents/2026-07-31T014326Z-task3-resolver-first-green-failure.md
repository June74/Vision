# SB-20260731-014326-task3-resolver-first-green-failure: Task 3 resolver repair remained red after first production change

- **Status:** closed
- **First observed:** 2026-07-31T01:43:26.439292Z
- **Last observed:** 2026-07-31T02:10:48.4061973Z
- **Phase/task:** Phase B Task 3 decisive resolver repair
- **Environment:** Local Phase B worktree; focused Vitest observer suite
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus unstaged resolver RED/GREEN work

## Symptom

The focused observer suite still reported one failing test file with a fixed safe resolver-failure category after the first production implementation.

## Impact

The resolver lane paused before failure inspection; only the resolver source and its unit test were modified, with no provider, live, or protected-data effect.

## Reproduction conditions

Run the focused observer-resolution unit suite after the first implementation
of the distinct timestamp grammar, provider-second overlap, exact projection,
and maintenance-causality changes.

## Safe evidence

The sanitized runner returned one failed test-file count and the fixed safe
resolver-failure category. It emitted no raw stream, URL, provider value,
fixture, credential, or account data.

## Attempts and outcomes

- New RED coverage was added for the accepted resolver findings.
- The first production implementation did not make the complete focused file
  green, so the writer stopped before reading failure details.
- Bounded diagnosis found fixture drift in the detailed-run timestamp. After
  correcting it, one of the two isolated provider-second boundary cases passed
  and the other remained red.
- A later terminal-poll deadline RED test remained one assertion short of GREEN
  after the fixed five-second settlement cap was implemented.
- Bounded diagnosis confirmed the production deadline was correct; the test
  harness exhausted its microtask-turn budget before the 25th poll.

## Cause classification

- **Confirmed cause:** The provider-second failures were fixture-ordering
  drift, not the interval rule. The terminal-poll failure was a bounded test
  harness budget that stopped before the 25th poll. The
  provider-second interval rule. The detailed run first remained in a later
  second; then a spread operation overwrote the intended page-one lower-bound
  second and made the mocked provider pages non-descending.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No provider, network, live request, protected value,
  restore operation, controller lifecycle, or external state was involved.

## Correction and prevention

- **Correction:** Keep both compatible fixtures in the same overlapping
  whole-second bucket, preserve descending provider order across pages, and
  raise only the deterministic harness turn budget enough to expose the 25th
  terminal poll.
- **Prevention:** Run each resolver boundary group independently before the
  combined file so the first failing invariant is isolated.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; continue exact inventory and commit.

## Verification and related work

Fresh verification passed all 56 resolver tests, typecheck, documentation
coverage, and the security scan. The production terminal poll retains the
120-second close plus exactly one fixed five-second settlement cap.

## Recurrence history

- 2026-07-31T01:43:26.439292Z: First observed.
- 2026-07-31T01:46:26.2230913Z: After the first fixture correction, one
  provider-second overlap test became green but its paired boundary test
  remained red. The writer stopped before another inspection; no raw output,
  provider action, protected value, or external state was involved.
- 2026-07-31T01:48:05.9162242Z: Bounded diagnosis found the second fixture's
  spread-order overwrite and corrected the mock's descending provider order.
  Both isolated boundary tests passed.
- 2026-07-31T02:08:29.8745286Z: Reopened when the new terminal-poll deadline
  test remained red by one assertion after the five-second settlement cap was
  added. No staging, raw diagnostic, provider action, or external state was
  involved.
- 2026-07-31T02:10:48.4061973Z: Closed after bounded diagnosis showed the
  deterministic harness stopped before the 25th poll. Raising only that
  harness budget exposed the poll; 56 resolver tests and all static/security
  gates passed.
