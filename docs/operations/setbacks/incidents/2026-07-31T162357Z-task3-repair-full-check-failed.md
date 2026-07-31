# SB-20260731-162357-task3-repair-full-check-failed: Integrated Task 3 repair failed the complete repository gate

- **Status:** closed
- **First observed:** 2026-07-31T16:23:57.6604454Z
- **Last observed:** 2026-07-31T16:39:07.0022235Z
- **Phase/task:** Phase B Task 3 second-wave blocker repair integration
- **Environment:** Local complete repository verification
- **Version/commit:** 6dfdd38 plus 18 unstaged implementation paths

## Symptom

The output-suppressed `pnpm check` gate exited nonzero after the integrated
focused suite and the independent typecheck, documentation, security, and
build gates all passed.

## Impact

The repair is not accepted or committed. Output suppression prevented raw test
or runtime data from being emitted. No provider, network, deployment, secret,
or external mutation occurred.

## Cause classification

- **Confirmed cause:** The permanent temporary-surface cleanup guard retained
  the old observer outer and inner timeout literals because that cross-cutting
  security test was outside the three repair-lane allowlists.
- **Hypotheses:** None remaining.
- **Known exclusions:** Contract and Worker projects pass; the unit failure is
  one assertion in one repository security test. The 263-test integrated
  focused group, typecheck, documentation coverage, security evidence,
  security scan, and build also pass.

## Correction and prevention

- **Correction:** Resolve the complete gate into bounded subcommand exit
  categories, isolate the failing file without printing raw streams, and fix
  test-first if it is an implementation defect.
- **Prevention:** Keep the full repository gate mandatory after every
  multi-lane repair, even when all focused gates pass.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Read the local `check` script definition and run
  only its not-yet-proved stages with output suppressed and exit categories.

## Recurrence history

- 2026-07-31T16:23:57.6604454Z: First observed and contained before diagnosis.
- 2026-07-31T16:27:08.8551663Z: The first three-project diagnostic used a
  rejecting parallel aggregate, so one nonzero child aborted the wrapper before
  all project labels were returned. Output remained suppressed and no external
  state changed. The retry preserves each child exit code while returning a
  successful diagnostic wrapper.
- 2026-07-31T16:32:58.7339168Z: Bounded project classification proved only the
  unit project failed. A suppressed JSON diagnostic identified one failing
  security-test path and one assertion; stack-location-only extraction traced
  it to the two stale observer timeout literals. The guard is now the exact
  test-first RED for the integration correction.
- 2026-07-31T16:39:07.0022235Z: Closed after the corrected permanent cleanup
  guard passed 8 tests, the full unit project passed, the temporary diagnostic
  was removed, and the complete repository `check` gate exited successfully.
