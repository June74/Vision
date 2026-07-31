# SB-20260731-004426-task3-ignored-report-partial-stage: Task 3 exact stage required a separate force-add for the ignored report

- **Status:** closed
- **First observed:** 2026-07-31T00:44:26.090504Z
- **Last observed:** 2026-07-31T00:44:26.090504Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final bounded commit
- **Environment:** Local linked-worktree exact staging
- **Version/commit:** `870de3980789bc275f6ea0816356ccace534d2b0`

## Symptom

The escalated exact stage added 28 allowlisted paths but returned nonzero because the Task 3 report is intentionally ignored and required a separate force-add.

## Impact

The index was partially staged until exact inspection and report-only force-add completed; no unintended or setback path entered the commit.

## Reproduction conditions

Stage the 29-path allowlist with ordinary `git add` even though one controller
report is intentionally ignored by repository rules.

## Safe evidence

Exact cached inspection showed the other 28 allowlisted paths staged and no
unintended path.

## Attempts and outcomes

- The first escalated add returned nonzero after staging 28 paths.
- Cached status was inspected exactly.
- Only the intended report was force-added, then cached path/diff checks passed.

## Cause classification

- **Confirmed cause:** The controller report is intentionally ignored and needs
  explicit force-add.
- **Hypotheses:** None.
- **Rejected hypotheses:** No path typo, index corruption, or unrelated staged
  file caused the nonzero result.
- **Known exclusions:** No setback path, protected value, provider, network,
  deployment, or external state entered the commit.

## Correction and prevention

- **Correction:** Inspect the partial index, then force-add only the exact
  ignored report.
- **Prevention:** Split future exact stages into tracked allowlist plus a
  deliberate report-only force-add from the outset.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The final commit contains exactly 29 allowlisted paths, zero setback paths, and
the post-commit index is empty.

## Recurrence history

- 2026-07-31T00:44:26.090504Z: First observed.
