# Setback SB-20260801-011048-task7-safe-push-symbolic-head

- **Status:** contained
- **Detected:** 2026-08-01T01:10:48.6027508Z
- **Scope:** Phase B Task 7 exact-tip review

## What happened

The required independent exact-tip review found that `push_exact` verifies the
expected commit but asks Git to push symbolic `HEAD`. If local `HEAD` differs
or moves between review and push, Git could send an unreviewed object before
the adapter's post-push comparison fails.

## Impact

The immutable candidate review failed with one Important finding. No push,
deployment, provider mutation, live acceptance, cleanup, or key change
occurred. Task 8 remains blocked.

## Cause classification

- **Confirmed cause:** The push refspec is based on `HEAD` rather than the
  already validated canonical expected commit, and the remote update is not
  atomically leased to the expected parent.
- **Rejected hypothesis:** The post-push equality check alone prevents an
  incorrect update; it detects the problem only after the remote may change.

## Correction and prevention

- **Correction:** Test-first, require Git to push the canonical expected commit
  object and bind the destination update to the exact expected parent.
- **Prevention:** Security review must inspect the actual refspec and update
  precondition, not only pre/post equality checks.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun affected/full gates and obtain a new
  independent exact-tip review.

## TDD evidence

- RED: the new exact-refspec test was the sole failure; 1,692 other unit tests
  passed and one remained intentionally skipped.
- GREEN: the focused adapter file passed all 14 tests after the adapter named
  the canonical expected commit and exact-parent lease in the Git argument
  vector.
- Full affected gate: TypeScript, documentation coverage, release security,
  and the aggregate repository check exited zero. A new exact-tip review is
  still required before push.
