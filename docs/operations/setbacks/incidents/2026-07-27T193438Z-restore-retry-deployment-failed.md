# SB-20260727-193438-restore-retry-deployment-failed: Exact reviewed restore retry deployment failed

- **Status:** closed
- **First observed:** 2026-07-27T19:34:38Z
- **Last observed:** 2026-07-27T19:57:34Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Preview GitHub Actions deployment
- **Version/commit:** `9bbc4be`

## Symptom

The workflow dispatched for the exact reviewed restore candidate completed with
failure before the 16-minute privacy-safe restore observation was started.

## Impact

No restore evidence was accepted and the disposable target remains retained.
The temporary restore secrets are present pending fail-closed diagnosis and
cleanup.

## Cause classification

- **Confirmed cause:** The pre-deployment unit suite contained an older
  cross-cutting workflow assertion that still required the obsolete
  85-second tail command after the implementation changed to 16 minutes.
- **Known exclusions:** The safe-tail workflow was not dispatched and the
  deploy job did not run, so neither the Worker nor restore target changed.

## Correction and prevention

- **Immediate containment:** Do not start the safe-tail workflow or delete the
  disposable branch.
- **Diagnosis:** Inspect only job and step names first; review the smallest safe
  log fragment only if the stage cannot otherwise be classified.
- **Fail-closed path:** If the candidate did not become the active Worker,
  retain normal code, delete the two temporary secrets, and keep the disposable
  branch until a reviewed retry is possible.

## Verification and related work

The failure was isolated to `Run application checks`, then reproduced locally
as one failing routing/workflow unit test. After correction, full local gates
and a reopened independent review passed. The new workflow run completed
successfully, and a closed log check confirmed both the exact reviewed commit
and deploy step without printing hosted logs.
