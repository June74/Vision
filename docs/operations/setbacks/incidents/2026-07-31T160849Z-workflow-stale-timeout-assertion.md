# SB-20260731-160849-workflow-stale-timeout-assertion: Workflow repair left one old timeout assertion

- **Status:** closed
- **First observed:** 2026-07-31T16:08:49.9473712Z
- **Last observed:** 2026-07-31T16:17:56.4875463Z
- **Phase/task:** Phase B Task 3 workflow blocker repair
- **Environment:** Focused local unit and workflow tests
- **Version/commit:** 6dfdd38 plus unstaged repair

## Symptom

The first GREEN run passed 151 of 152 tests; one owned workflow-contract
assertion still expected the former observer job timeout rather than the newly
derived 44-minute bound.

## Impact

The gate remained red and no repair was accepted. No provider, network,
deployment, secret, protected output, or external mutation occurred.

## Cause classification

- **Confirmed cause:** The implementation and new behavioral coverage were
  updated, but one existing literal timeout assertion in the owned workflow
  suite was missed.
- **Hypotheses:** None remaining.
- **Known exclusions:** The new behavior tests and all other focused tests
  passed.

## Correction and prevention

- **Correction:** Update the single owned assertion to the same derived
  44-minute bound and rerun the identical four-file scope.
- **Prevention:** Search all owned workflow timeout literals whenever a shared
  lifecycle duration changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Require 152 of 152 focused tests before wider
  verification.

## Recurrence history

- 2026-07-31T16:08:49.9473712Z: First observed and contained before retry.
- 2026-07-31T16:09:34.7828738Z: Recurred after the job-timeout assertion was
  corrected because its adjacent inner-timeout assertion still expected the
  old value. The identical scope again passed 151 of 152 tests with no external
  action or sensitive output. The lane must update the adjacent assertion to
  42 minutes, search the owned test for remaining old timeout literals, and
  rerun.
- 2026-07-31T16:17:56.4875463Z: Closed after the owned timeout search found no
  stale literals and the focused four-file scope passed all 154 tests.
