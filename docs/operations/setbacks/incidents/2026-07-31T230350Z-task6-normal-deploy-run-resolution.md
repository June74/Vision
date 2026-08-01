# SB-20260731-230350-task6-normal-deploy-run-resolution: Normal deploy runner did not prove bounded unique chronology

- **Status:** closed
- **First observed:** 2026-07-31T23:03:50.4985793Z
- **Last observed:** 2026-07-31T23:08:05.0075675Z
- **Phase/task:** Phase B Task 6 safe-runner independent review
- **Environment:** Local injected-seam source/test review
- **Version/commit:** a22c345 plus uncommitted Task 6 lanes

## Symptom

The normal-deploy runner requires the provider's entire returned run array to
have length one but does not request or prove a complete closed-interval result.
Complete history eventually causes false failure, while a truncated response
can hide concurrent duplicates. Job and attribution start times are also
compared to runner start rather than workflow run creation.

## Impact

The runner can reject a valid deployment after unrelated historical runs,
accept an unproven unique run, and admit impossible job/artifact chronology.
No real remote Git, provider, network, deployment, staging, or external action
occurred.

## Cause classification

- **Confirmed cause:** Uniqueness was applied to an unbounded provider list
  rather than a complete bounded dispatch interval.
- **Confirmed cause:** Downstream evidence chronology used the outer runner
  start instead of `runCreatedAt`.

## Correction and prevention

- **Correction:** Add RED cases where stale plus one in-window run succeeds,
  two in-window runs fail, incomplete pagination fails, and job/artifact starts
  before run creation fail; then require complete bounded resolution and exact
  run-relative chronology.
- **Prevention:** Resolve uniqueness only over a proven complete closed set and
  anchor nested evidence to its immediate parent event.
- **Owner:** Codex.
- **Next diagnostic step:** Reproduce both findings with injected seams.

## Recurrence history

- 2026-07-31T23:03:50.4985793Z: Confirmed by independent read-only review.
- 2026-07-31T23:08:05.0075675Z: Closed after RED coverage for bounded
  completeness and run-relative chronology, followed by 47 focused GREEN tests,
  source TypeScript, documentation, and owned diff verification.
