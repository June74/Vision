# SB-20260728-002550-setback-helper-unavailable: Setback helper was unavailable in the worktree

- **Status:** closed
- **First observed:** 2026-07-28T00:25:50Z
- **Last observed:** 2026-07-30T01:58:36.5078652Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 5
- **Environment:** Local Phase B worktree
- **Version/commit:** `ff6a767`

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
