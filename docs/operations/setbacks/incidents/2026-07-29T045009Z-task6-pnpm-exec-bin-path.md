# SB-20260729-045009-task6-pnpm-exec-bin-path: pnpm exec omitted the local binary directory

- **Status:** closed
- **First observed:** 2026-07-29T04:50:09.1847792Z
- **Last observed:** 2026-07-31T22:50:18.6961654Z
- **Phase/task:** Phase B acceptance instrumentation and live-closure Task 6
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

`pnpm.cmd exec vitest ...` reported that `vitest` was not recognized, so the
requested baseline suite did not start.

## Impact

The first baseline run produced no test evidence. No source, workflow,
provider, database, browser, or network state changed.

## Reproduction conditions and safe evidence

The repository-local `node_modules/.bin/vitest.cmd` exists and reports the
expected Vitest version when invoked directly. `pnpm.cmd exec where.exe
vitest` exits one, and the child command path does not contain the worktree's
local binary directory.

## Attempts and outcomes

- The exact brief command did not start Vitest.
- Direct local-shim execution succeeded.
- The command environment and local shim were inspected without reading
  private values.

## Cause classification

- **Confirmed cause:** In this session, `pnpm exec` does not add the worktree's
  `node_modules/.bin` directory to the child command path.
- **Hypotheses:** The behavior may be specific to the managed Windows command
  wrapper.
- **Rejected hypotheses:** Vitest is not absent; its local command shim works.
- **Known exclusions:** No package reinstall or dependency mutation occurred.

## Correction and prevention

- **Correction:** Prefix verification calls with the resolved worktree-local
  `.bin` directory, then rerun the exact `pnpm.cmd exec` command.
- **Prevention:** Confirm that `pnpm exec` can resolve one local tool before
  treating its failure as product-test evidence in this session.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

With the worktree-local binary directory prefixed, the exact baseline suite
started normally and passed 2 files and 7 tests with zero failures.

## Recurrence history

- 2026-07-31T22:50:18.6961654Z: The live-closure Task 6 RED command repeated
  the documented `pnpm.cmd exec vitest` resolution failure before test loading.
  No test or external action ran; the retry uses the repository-local
  `node_modules/.bin/vitest.cmd` wrapper required by the Task 6 brief.
