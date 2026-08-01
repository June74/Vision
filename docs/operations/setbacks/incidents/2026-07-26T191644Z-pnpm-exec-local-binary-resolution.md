# SB-20260726-191644-pnpm-exec-local-binary-resolution: pnpm exec did not resolve local binary

- **Status:** closed
- **First observed:** 2026-07-26T19:16:44.091309Z
- **Last observed:** 2026-07-31T22:59:55.8433974Z
- **Phase/task:** Phase B live-acceptance closure Tasks 1, 4, and 6
- **Environment:** Local Windows PowerShell
- **Version/commit:** `7d2f9f6`; reviewed candidate `0f08fc1`

## Symptom

The Windows shell invocation of pnpm exec did not resolve an installed local executable, so the targeted test process never started.

## Impact

No code or provider state changed; RED verification was delayed until the local binary path was used directly.

## Reproduction conditions

Invoke a local executable through `pnpm exec` in this shell.

## Safe evidence

The package runner reported that the installed executable was not recognized.

## Attempts and outcomes

- The test process did not start through `pnpm exec`.
- The local executable path ran the intended suite successfully.

## Cause classification

- **Confirmed cause:** This PowerShell/package-runner combination did not
  resolve the local command wrapper.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Dependencies were installed and the executable existed.

## Correction and prevention

- **Correction:** Called the repository-local `.cmd` executable directly.
- **Prevention:** Use the local Windows command wrapper for ad hoc tool
  invocations in this worktree.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The latest repository-local wrapper retry ran the exact five Task 2 focused
files with 59 passing tests.

## Recurrence history

- 2026-07-26T19:16:44.091309Z: First observed.
- 2026-07-26T20:34:39.6525898Z: Recurred during focused local migration
  validation; no test started and the repository-local Windows wrapper was
  used for the retry.
- 2026-07-26T22:57:22Z: Recurred during normal backup-schedule restoration.
  No test started; the retry uses `node_modules/.bin/vitest.cmd` directly.
- 2026-07-27T00:19:11Z: Recurred during the AI Gateway identifier regression
  test. No test process started; the retry uses the repository-local Windows
  wrapper directly.
- 2026-07-27T13:14:09Z: Recurred during the restore tail-correction RED run.
  No test process started; the retry uses the repository-local Windows wrapper
  directly.
- 2026-07-27T19:41:30Z: Recurred during the missed routing-test correction.
  No test process started; the retry uses
  `node_modules/.bin/vitest.cmd` directly.
- 2026-07-28T01:20:44.6624354Z: Recurred during Task 3 candidate
  reconfirmation. Inspection confirmed that the local executable and its
  target both existed; the failure was pnpm command resolution, not a stale
  installation. The repository-local wrapper ran the exact five focused files
  with 59 passing tests. No provider mutation occurred.
- 2026-07-28T14:18:00Z: Recurred during a read-only CI capability audit when
  `pnpm exec` did not resolve the installed Wrangler binary. The local wrapper
  remained present, and no provider or repository mutation was attempted.
- 2026-07-29T03:11:29Z: Recurred twice while running a read-only inline
  classifier diagnostic through `pnpm exec` and `pnpm tsx`. Neither invocation
  resolved the local executable, no product or provider state changed, and the
  documented `node --import tsx` form completed successfully.
- 2026-07-29T18:47:59Z: Recurred during Task 7 candidate generation when
  `pnpm.cmd exec tsx` did not resolve the installed local wrapper. No candidate
  artifact was written, no application code ran, and no provider or external
  state changed. The local wrapper exists and will run the same script and
  arguments directly.
- 2026-07-30T19:08:57.9326924Z: Recurred during the exact Task 1 focused RED
  command. The test process did not start, the repository-local Vitest wrapper
  was confirmed present, and no implementation or provider state changed. The
  equivalent retry uses that local Windows wrapper directly.
- 2026-07-30T20:11:11.7052165Z: Recurred during Task 2 prerequisite/test-runner
  preparation before the new RED suites were written. The documented runner
  did not start the local test process; no Task 2 source or provider state
  changed. The already approved repository-local Windows wrapper remains the
  equivalent runner.
- 2026-07-30T21:05:32.6506918Z: Recurred when Task 3 ran the frozen 19-file RED
  command. No test process started and no repository or provider state changed.
  The retry uses the repository-local Vitest Windows wrapper with the identical
  project and file arguments.
- 2026-07-30T23:28:36.7050043Z: Recurred during the Task 3 final-repair
  focused RED run. The test process did not start, only RED test edits existed,
  and no production or provider state changed. The identical scope is retried
  through the repository-local Vitest Windows wrapper.
- 2026-07-31T15:59:20.1695396Z: Recurred in the R2 pagination repair lane when
  `pnpm exec` again failed to resolve Vitest before starting tests. Only the
  assigned adversarial test file had changed; no source, provider, network,
  secret, or external state was affected. The identical RED scope must use the
  repository-local `vitest.cmd` wrapper.
- 2026-07-31T16:01:39.9190720Z: Recurred independently in the candidate
  rollback-validation lane after test-only RED changes. The test process did
  not start, and no implementation, documentation, provider, network, secret,
  or external state was affected. That lane must also use the explicit local
  Windows wrapper.
- 2026-07-31T16:05:53.0217012Z: Closed after the explicit local Windows
  wrapper ran the R2 reader suite with 25 passing tests and the candidate
  provider-state suite with 84 passing tests.
- 2026-07-31T16:06:37.0618565Z: Reopened when the observer/controller lane's
  focused RED command used `pnpm exec` and failed before starting tests. Only
  owned test files had changed; no production, workflow, provider, network,
  secret, or external state was affected. The exact four-file scope must use
  the same repository-local Windows wrapper.
- 2026-07-31T16:17:56.4875463Z: Closed after the explicit local wrapper ran
  the final observer/controller scope with all 154 tests passing.
- 2026-07-31T20:09:32.0943834Z: Recurred during the Task 4 window/workflow RED
  run because the frozen command used `pnpm exec`. No test process, provider,
  network, or external mutation occurred; retry uses the explicit local
  Vitest Windows wrapper.
- 2026-07-31T20:19:26.9311954Z: Closed after the explicit local wrapper
  collected the same four-file scope and passed all 201 tests.
- 2026-07-31T21:47:11.1253084Z: Recurred during the Task 4 v1 AI
  compatibility RED attempt when `pnpm exec vitest` did not resolve Vitest.
  No test ran; the result was discarded and the next attempt uses the explicit
  repository-local Windows wrapper.
- 2026-07-31T21:48:44.0535215Z: Closed after the explicit local Windows
  wrapper ran the repaired focused suite with all 28 tests passing.
- 2026-07-31T22:59:55.8433974Z: Recurred when the Task 6 R2 lane invoked
  `pnpm exec tsc` directly. The compiler was not resolved, so no typecheck
  evidence was produced; the lane uses the project script or local wrapper.

The repository-local wrapper reached the candidate script, confirming the
package-runner resolution boundary. The workflow-equivalent local Node loader
then generated and validated the exact foundation artifact successfully. The
repository-local wrapper also ran the focused suite with 8 passing tests.
