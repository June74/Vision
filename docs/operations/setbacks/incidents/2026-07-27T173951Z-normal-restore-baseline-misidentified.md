# SB-20260727-173951-normal-restore-baseline-misidentified: Normal restore baseline was misidentified

- **Status:** closed
- **First observed:** 2026-07-27T17:39:51Z
- **Last observed:** 2026-07-27T17:42:12Z
- **Phase/task:** Phase B restore Task 4 fail-closed rollback
- **Environment:** Local Phase B worktree and preview deployment history
- **Version/commit:** reviewed candidate `41b05fd`

## Symptom

The first rollback classifier incorrectly rejected the actual normal
two-cron commit because it treated permanent restore-command variable names as
temporary runtime evidence and expected the wrong daily cron expression.

## Impact

The rollback dispatch was delayed while the classifier was corrected. No
incorrect ref was deployed, and no cleanup or branch deletion occurred.

## Reproduction conditions

Classify temporary runtime state using shared environment names and an assumed
daily cron time instead of the temporary job, test, evidence marker, and exact
commit-tree schedule.

## Safe evidence

A corrected commit-tree check proved that the ref has no temporary restore job,
temporary test, or restore evidence marker and has exactly the 15-minute and
daily normal schedules.

## Attempts and outcomes

- The initial check rejected permanent shared variable names and one
  incorrectly expected daily schedule.
- A per-marker path classification separated permanent restore-command use
  from the temporary Worker restore path.
- Exact tree and schedule checks accepted the immutable normal ref.

## Cause classification

- **Confirmed cause:** The classifier used overbroad shared variable names and
  the wrong expected daily cron expression.
- **Hypothesis:** None open.
- **Rejected hypotheses:** The planning baseline was not the wrong ref; the
  corrected tree evidence proves it is the normal runtime commit. Uncommitted
  local documentation was not involved.
- **Known exclusions:** No secret, token, database URL, branch identifier,
  account identifier, OAuth value, provider URL, or provider state was
  changed.

## Correction and prevention

- **Correction:** Require the temporary job/test/evidence marker to be absent
  and compare the exact two schedule values from the immutable ref.
- **Prevention:** Never select a rollback ref from a narrative baseline label;
  verify the immutable commit tree against the cleanup invariants.
- **Owner:** Codex.
- **Next diagnostic step:** Deploy the verified immutable normal ref.

## Verification and related work

The incident is closed because one immutable normal ref passed both source and
schedule checks before dispatch.

## Recurrence history

- 2026-07-27T17:39:51Z: First observed and contained before deployment.
- 2026-07-27T17:42:12Z: Closed after the corrected tree and schedule
  classifier proved the presumed baseline was the exact normal runtime ref.
