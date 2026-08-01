# SB-20260727-010827-direct-vitest-command-unavailable: Direct Vitest command was unavailable

- **Status:** closed
- **First observed:** 2026-07-27T01:08:27Z
- **Last observed:** 2026-07-31T21:02:25.7615346-05:00
- **Phase/task:** Phase B Task 7 continuation
- **Environment:** Local Windows worktree
- **Version/commit:** `22c5dc0`

## Symptom

The targeted test command exited immediately because `vitest` was not resolved
as a direct executable.

## Impact

No test ran and no project or provider state changed.

## Cause classification

- **Confirmed cause:** The command bypassed the repository's declared package
  script.
- **Known exclusions:** This was not a test failure or dependency defect.

## Correction and prevention

- **Correction:** Run focused unit files through
  `.\node_modules\.bin\vitest.cmd run --project unit <path>`.
- **Prevention:** Inspect `package.json` and the local command shims before
  invoking a project tool directly on Windows. Do not append a focused file to
  `pnpm.cmd test:unit` with `--`: this script passes the literal separator to
  Vitest and starts the full unit project instead of a focused run.

## Verification and related work

The targeted Gateway test passed all nine cases through the repository's
declared unit-test script.

## Recurrence history

- 2026-07-27T01:08:27Z: First observed during focused Gateway testing.
- 2026-07-27T01:41:39Z: Recurred during the clean-room integration-only
  rerun when `pnpm exec vitest` bypassed the declared script. No test ran; the
  corrected command uses `pnpm.cmd test:unit tests/integration`.
- 2026-07-28T18:47:00.4534017Z: Recurred when the Task 1 brief's exact
  `pnpm.cmd exec vitest` command could not resolve the executable even though
  the local command shim exists. No test ran and no project or provider state
  changed. The correction uses the repository's declared `test:unit` script
  with the same focused file arguments.
- 2026-07-28T19:45:53.3444547Z: Recurred when the Task 2 brief's exact
  `pnpm.cmd exec vitest` command could not resolve the executable. No test ran
  and no project or provider state changed. The correction again uses the
  repository's declared `test:unit` script with the same focused unit-project
  file arguments.
- 2026-07-28T20:48:09.8256033Z: Recurred when the Task 3 brief's exact
  `pnpm.cmd exec vitest` command could not resolve the executable even though
  the local command shim exists. No test ran and no project or provider state
  changed. The correction again uses the repository's declared `test:unit`
  script with the same focused file arguments.
- 2026-07-28T22:28:37.0398177Z: The same direct executable resolution issue
  recurred for `pnpm.cmd exec tsx` while starting the closed live-attestation
  validator. The validator did not run, no attestation values were printed,
  and no file or external state changed. The retry uses a repository-declared
  script boundary.
- 2026-07-28T23:02:59.5413784Z: Recurred for the Task 4 brief's exact
  `pnpm.cmd exec vitest` command. No test ran and no project or provider state
  changed. The corrected command uses `pnpm.cmd test:unit` with the same
  focused file arguments.
- 2026-07-29T03:24:33Z: Recurred for the Task 5 brief's exact
  `pnpm.cmd exec vitest` command. No test ran and no project or provider state
  changed. The corrected command uses `pnpm.cmd test:unit` with the same
  focused unit-project file argument.
- 2026-08-01T01:12:00.0000000Z: Recurred while starting the Task 7 safe-push
  regression RED through `pnpm.cmd exec vitest`. The executable was not
  resolved, so no test or production code ran and no external state changed.
  The retry uses the repository-declared `pnpm.cmd test:unit` script with the
  same exact file filter.
- 2026-07-31T21:02:25.7615346-05:00: Recurred while starting the Task 7
  continuation cleanup-inventory check through `pnpm.cmd exec vitest`; the
  executable was not resolved, so no test or external state changed. The
  attempted package-script fallback started the full unit project because the
  literal `--` reached Vitest and timed out under the bounded local runner.
  Focused retries use the verified local `vitest.cmd` shim directly.
