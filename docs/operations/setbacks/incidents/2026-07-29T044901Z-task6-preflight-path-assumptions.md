# SB-20260729-044901-task6-preflight-path-assumptions: Task 6 preflight assumed unavailable paths and commands

- **Status:** closed
- **First observed:** 2026-07-29T04:46:00Z
- **Last observed:** 2026-07-31T23:18:47.1299665Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

The first bounded plan lookup targeted a nonexistent `.superpowers/sdd`
plan copy instead of the source plan named by the brief. The setback follow-up
also assumed that the generic `scripts/new_setback.py` helper existed. A broad
recursive fallback crossed a missing generated dependency path, and two later
inspection conveniences used a PowerShell parameter and an incident filename
that were not available.

## Impact

Preflight inspection was delayed. No production, workflow, database, provider,
browser, or network state changed, and no private value was read or recorded.

## Reproduction conditions and safe evidence

- `.superpowers/sdd/acceptance-plan.md` is absent.
- `scripts/new_setback.py` is absent, matching the earlier repository incident
  for the generic helper.
- A repository-wide recursive filesystem walk crossed a missing generated
  dependency directory.
- This PowerShell version does not support `Get-Date -AsUTC`.
- The assumed historical incident filename did not match the tracked name.

## Attempts and outcomes

- The Task 6 brief loaded before the plan lookup failed.
- Bounded `git ls-files` located the authoritative plan at
  `docs/superpowers/plans/2026-07-28-phase-b-acceptance-instrumentation.md`.
- Direct Git worktree inspection confirmed the requested branch and base.
- UTC time was obtained with `ToUniversalTime().ToString(...)`.
- This record and its index row were created with `apply_patch`.

## Cause classification

- **Confirmed cause:** Preflight convenience commands assumed paths, a helper,
  and a PowerShell option without first checking repository-tracked files and
  the local shell version.
- **Hypotheses:** None.
- **Rejected hypotheses:** The requested Task 6 brief and authoritative plan
  were not missing; only the assumed convenience paths were absent.
- **Known exclusions:** No implementation file changed before the failures.

## Correction and prevention

- **Correction:** Use brief-provided paths, bounded `git ls-files`, direct
  repository-relative reads, and PowerShell-version-compatible UTC formatting.
- **Prevention:** Avoid repository-wide recursive scans through generated
  dependencies, and verify tracked filenames before opening historical records.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The authoritative plan path, linked-worktree path, branch
`codex/phase-b-foundation`, and base `1c7f89b` were all confirmed by the
corrected bounded preflight. For the current recurrence, bounded tracked-file
discovery confirmed `.github/workflows/preview.yml` as the exact workflow
path.

## Recurrence history

- 2026-07-30T00:33:50.2150076Z: A wave-3 artifact-check lookup assumed the
  nonexistent `.github/workflows/deploy-preview.yml` filename. The read-only
  lookup failed before any candidate generation or deployment action. No
  project, provider, or private state changed.
- 2026-07-31T22:44:50Z: The Task 6 safe-runner preflight included a
  nonexistent `docs/plans` glob beside the exact brief directory. The bounded
  read failed after listing filenames, before implementation or external
  action. The authoritative path remains discoverable from the Task 6 brief.
- 2026-07-31T23:05:19.9065756Z: Recurred when the safe-runner repair assumed
  the newly created review-incident filename instead of resolving it from the
  current index. No source repair or external action occurred; future reads use
  the exact indexed path supplied by the controller.
- 2026-07-31T23:18:47.1299665Z: Recurred when the R2 re-review prompt used
  `docs/references` instead of the repository's actual `docs/reference` paths.
  The reviewer therefore reported two absent references; bounded controller
  checks confirmed both required singular-path files exist. No implementation
  or external state changed, and the corrected paths are supplied for re-review.
