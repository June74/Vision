# SB-20260728-002550-setback-helper-unavailable: Setback helper was unavailable in the worktree

- **Status:** closed
- **First observed:** 2026-07-28T00:25:50Z
- **Last observed:** 2026-08-02T01:41:14.3143298Z
- **Phase/task:** Phase B Task 7 correlation repair and Task 8 prepublication readiness
- **Environment:** Local Phase B worktree
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The setback skill named `scripts/new_setback.py`, but that helper was absent
from this repository. A broad recursive fallback search also encountered a
missing generated dependency directory before tracked-file inspection
confirmed the helper was not present.

## Impact

Setback documentation required a manual repository-convention fallback. No
implementation, database, provider, browser, or network state changed.

## Reproduction conditions and safe evidence

Tracked-file inspection contains no `new_setback.py`, and direct inspection of
the named path reports that it does not exist. The recursive fallback crossed
generated dependency links and reported one missing generated directory.

## Attempts and outcomes

- Direct helper inspection failed because the file was absent.
- The recursive fallback was stopped after a generated dependency path error.
- `git ls-files` safely confirmed that no tracked helper exists.
- The incidents and index rows were created with the repository's existing
  Markdown convention.
- The Task 4 recurrence failed before writing anything; bounded ledger-local
  inspection reconfirmed the helper is absent and the manual fallback remains
  required.

## Cause classification

- **Confirmed cause:** This worktree does not contain the helper named by the
  generic setback skill.
- **Hypotheses:** The helper may belong to another repository template.
- **Rejected hypotheses:** The helper was not merely hidden under another
  tracked path.
- **Known exclusions:** No private value was read, recorded, or exposed.

## Correction and prevention

- **Correction:** Use `git ls-files` for bounded helper discovery and
  `apply_patch` for the documented manual fallback.
- **Prevention:** Check the named helper path and tracked files before any
  recursive search.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The new incident files and index rows are present, and subsequent preflight
inspection uses bounded tracked-file queries.

## Recurrence history

- 2026-07-30T01:58:36.5078652Z: Wave 5 followed the generic helper name as
  though it were repository-relative. The direct help probe failed before any
  write. Bounded discovery confirmed the helper belongs to the skill directory,
  while this repository still requires the documented manual fallback.
- 2026-07-30T19:10:30.8275680Z: Task 1 again treated the generic helper name as
  repository-relative. The direct help probe failed before any write, and a
  bounded ledger-local search confirmed no worktree copy exists. The follow-up
  uses the skill-directory helper or the documented manual fallback.
- 2026-08-01T20:21:39.2021464Z: Task 4 coverage logging again invoked the
  generic repository-relative helper path. It failed before writing anything;
  bounded ledger inspection reconfirmed the documented manual fallback.
- 2026-08-02T01:41:14.3143298Z: Task 8 prepublication readiness followed the
  generic repository-relative helper path after a worktree diagnostic setback.
  The help probe failed before writing anything, so the documented manual
  `apply_patch` fallback was used without inspecting unrelated paths.
