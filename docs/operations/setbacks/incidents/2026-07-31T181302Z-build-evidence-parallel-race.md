# SB-20260731-181302-build-evidence-parallel-race: Release evidence raced the production build

- **Status:** closed
- **First observed:** 2026-07-31T18:13:02.8551025Z
- **Last observed:** 2026-07-31T18:14:41.3924364Z
- **Phase/task:** Phase B Task 3 combined root verification
- **Environment:** Local verification commands
- **Version/commit:** 0c3ea58 plus lifecycle repair edits

## Symptom

The production build and release-evidence capture ran concurrently. Evidence
inspection found the client build directory empty while the build process was
recreating it and exited before computing the release digest.

## Impact

The combined verification result is invalid and must be rerun in dependency
order. No provider, network, environment, secret, staging, or commit was
touched.

## Cause classification

- **Confirmed cause:** The build mutates the same output directory that the
  release-evidence command reads, so those gates are not independent and cannot
  run in parallel.
- **Hypotheses:** Other parallel gates may have completed, but their output was
  not retained by the failed orchestration call and will be rerun.
- **Known exclusions:** The prior focused suite passed 216 of 216 tests; this
  was not a source-test failure.

## Correction and prevention

- **Correction:** Run the production build to completion first, then run
  release evidence and security scanning against the completed output. Rerun
  the remaining gates for fresh explicit results.
- **Prevention:** Parallelize only verification commands without shared read or
  write artifacts; treat build output and evidence capture as a dependency
  chain.
- **Owner:** Codex.
- **Next diagnostic step:** Run `pnpm.cmd build`, then the evidence gate.

## Recurrence history

- 2026-07-31T18:13:02.8551025Z: Observed and contained after the local evidence
  command reported an empty in-progress build directory.
- 2026-07-31T18:14:41.3924364Z: Closed after sequential build, release-evidence,
  and release-security gates all completed successfully.
