# SB-20260729-173140-task6-review-local-vitest-resolution: Package runner did not resolve local binaries

- **Status:** closed
- **First observed:** 2026-07-29T17:30:55Z
- **Last observed:** 2026-07-30T01:14:27.2684315Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final re-review
- **Environment:** Local Phase B linked worktree in Windows PowerShell
- **Version/commit:** Working changes based on `41d3e74`

## Symptom

`pnpm.cmd vitest run tests/security/temporary-surface-cleanup.test.ts`
reported that `vitest` was not recognized even though the dependency is
installed. The first timestamp diagnostic also used the unsupported
`Get-Date -AsUTC` parameter. The same resolution failure recurred when the
consolidated RED wave used `pnpm exec vitest`.

## Impact

The cleanup test did not start on that attempt. No provider, database,
browser, runtime, or external state changed.

## Reproduction conditions and safe evidence

The repository contains `node_modules/.bin/vitest.CMD` and the package
manifest pins Vitest. This PowerShell/package-runner combination did not add
the local binary directory for the direct `pnpm vitest` form. This PowerShell
version also lacks `Get-Date -AsUTC`.

## Attempts and outcomes

- Direct `pnpm.cmd vitest` failed before test collection.
- A read-only dependency check confirmed the local executable exists.
- `(Get-Date).ToUniversalTime()` produced the required UTC timestamp.

## Cause classification

- **Confirmed cause:** The direct package-runner form did not resolve the
  installed local executable in this shell.
- **Confirmed cause:** The local PowerShell version does not support
  `Get-Date -AsUTC`.
- **Hypotheses:** None.
- **Known exclusions:** The failures were unrelated to the cleanup assertions
  or implementation.

## Correction and prevention

- **Correction:** Invoke the repository-pinned
  `node_modules/.bin/vitest.cmd` executable directly and use
  `(Get-Date).ToUniversalTime()` for UTC timestamps.
- **Prevention:** Prefer package scripts or the explicit repository-local
  executable in this worktree.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The consolidated focused suite collected through the verified local
executable and produced only the intended RED failures.

## Recurrence history

- 2026-07-29T22:12:31.6559531Z: `pnpm.cmd exec vitest` again failed before
  collection while starting the parser-backed workflow regression. No test,
  repository, runtime, or provider state changed; the retry uses the
  repository-pinned executable directly.
- 2026-07-29T23:28:10.1332873Z: `pnpm.cmd exec wrangler` did not resolve the
  installed Wrangler executable during a local nondeploy dry-run. Preview
  build, artifact validation, and pricing attestation had already passed; no
  deployment or provider request began. The retry uses the verified
  repository-local `wrangler.CMD`.
- 2026-07-30T01:14:27.2684315Z: The independent Task 7 reviewer used the
  package-runner exec form for one focused Vitest check. The local executable
  was not resolved, so no test was collected or executed. The reviewer stopped
  without retrying, editing repository state, or accessing an external system.
