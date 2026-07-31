# SB-20260731-211007-task4-full-check-failure: Task 4 integrated repository check exited nonzero

- **Status:** closed
- **First observed:** 2026-07-31T21:10:07.2147568Z
- **Last observed:** 2026-07-31T21:33:25.6804298Z
- **Phase/task:** Phase B Task 4 complete repository verification
- **Environment:** Local managed worktree with captured output
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The authoritative `pnpm check` wrapper exited with status 1 after the focused
Task 4 suites, TypeScript, documentation, browser, Worker, and release-security
checks had passed.

## Impact

Task 4 is not accepted or staged. Captured output has not been rendered and no
failure hypothesis has been adopted yet.

## Cause classification

- **Confirmed cause:** Two cleanup assertions found the intentionally created
  in-worktree capture directory. Four existing safe-tail CLI tests exhausted
  their local timeout under full-suite concurrency; the identical file passed
  all 28 tests immediately when rerun alone.
- **Confirmed follow-up:** The safe-tail failures were full-suite process
  contention, and the permanent cleanup test required synchronized Task 4
  residue plus a whitespace-tolerant retained-suite anchor.
- **Hypotheses:** None remaining.
- **Known exclusions:** No live provider, network, database, deployment,
  secret, staging state, or commit changed.

## Correction and prevention

- **Correction:** Classify only safe summary markers and failing local paths
  from the captured streams, then reproduce the exact failing stage alone.
- **Prevention:** Keep complete-gate output captured until it is safely
  classified and rerun the whole gate after correction.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T21:10:07.2147568Z: First integrated Task 4 full-check attempt
  exited 1 after 222.8 seconds; output remains captured.
- 2026-07-31T21:10:07.2147568Z: Safe classification found 94 passing unit
  files, one skip, two failing files, 1,534 passing tests, one skip, and six
  failures. Four failures were local CLI timeouts; the remaining two were the
  expected cleanup reaction to the capture directory. The CLI file then passed
  28 of 28 in isolation.
- 2026-07-31T21:18:11.1493630Z: The clean rerun captured outside the worktree
  also exited 1 after 227.1 seconds. No raw output has been rendered; cleanup
  artifacts were absent from the worktree before the run.
- 2026-07-31T21:28:03.1865367Z: The third clean rerun exited 1 after 137.9
  seconds following cleanup-inventory and subprocess-timeout corrections. Its
  external capture remains unread pending safe classification.
- 2026-07-31T21:33:25.6804298Z: Closed after the fourth clean complete gate
  passed 1,540 unit/integration/security tests with one intentional skip, 179
  contract tests, 110 Worker tests, both production builds, documentation,
  release evidence, and release security validation.
