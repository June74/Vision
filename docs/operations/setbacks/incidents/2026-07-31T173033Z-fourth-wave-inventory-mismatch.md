# SB-20260731-173033-fourth-wave-inventory-mismatch: Fourth-wave repair includes one path outside the Task 3 report inventory

- **Status:** closed
- **First observed:** 2026-07-31T17:30:33.3858551Z
- **Last observed:** 2026-07-31T17:31:21.3811353Z
- **Phase/task:** Phase B Task 3 fourth-wave repair integration
- **Environment:** Local exact-scope audit
- **Version/commit:** 752b81f plus 24 unstaged implementation paths

## Symptom

The integrated repair has 24 implementation paths, and one is not present in
the report's frozen 77-path inventory. The diff check succeeds, but Git also
emits the known Windows normalization advisories for the 24 paths.

## Impact

The repair cannot be staged until the single path is classified as required
scope or removed. No provider, network, deployment, secret, or external
mutation occurred.

## Cause classification

- **Confirmed cause:** The candidate lifecycle repair necessarily added
  `tests/unit/ci/workflow-yaml.test.ts` to prove every fallible predeploy check
  precedes the durable mutation boundary and candidate deployment; the prior
  report inventory did not include that test.
- **Hypotheses:** None remaining.
- **Known exclusions:** No path is staged, the diff check passes, and no local
  check diagnostic remains.

## Correction and prevention

- **Correction:** Emit only the one relative path, trace whether it is already
  changed from the Task 3 base, and either update the report inventory or remove
  an unauthorized change.
- **Prevention:** Run exact inventory equality before staging every review-wave
  repair.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Output the single repository-relative path only.

## Recurrence history

- 2026-07-31T17:30:33.3858551Z: First observed and contained before staging.
- 2026-07-31T17:31:21.3811353Z: Closed after exact diff inspection proved the
  path is required Task 3 lifecycle coverage. The canonical inventory must
  increase from 77 to 78 paths after the implementation commit.
