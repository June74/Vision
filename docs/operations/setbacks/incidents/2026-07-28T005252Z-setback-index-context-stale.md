# SB-20260728-005252-setback-index-context-stale: Setback index patch used stale timestamp context

- **Status:** closed
- **First observed:** 2026-07-28T00:52:52.8805934Z
- **Last observed:** 2026-07-28T01:21:32.8180667Z
- **Phase/task:** Listener-first restore retry Task 3 Step 1 reporting
- **Environment:** Local Phase B worktree
- **Version/commit:** `7d2f9f6`

## Symptom

A recurrence update expected the setback index to carry the incident file's
newer timestamp, but the index row still carried its previous timestamp.
`apply_patch` rejected the complete patch before making any change.

## Impact

Only setback bookkeeping was delayed. Source, tests, provider state, and
private-data boundaries were unchanged.

## Reproduction conditions and safe evidence

Use an incident-file timestamp as patch context for an index row that has not
yet received that earlier incident update.

## Attempts and outcomes

- The first patch was rejected atomically.
- Exact inspection identified the current index row and incident timestamp.
- The recurrence was then applied against the exact current row.

## Cause classification

- **Confirmed cause:** The incident file and index row were temporarily out of
  sync, and the patch used the incident timestamp for both.
- **Hypotheses:** None.
- **Rejected hypotheses:** No partial patch was applied.
- **Known exclusions:** No private value or provider action was involved.

## Correction and prevention

- **Correction:** Patch each file from its independently inspected current
  context.
- **Prevention:** Read both the incident header and index row before a combined
  recurrence update.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The index now matches the incident's latest observation and this safe incident
is indexed once.

## Recurrence history

- 2026-07-28T01:21:32.8180667Z: A combined recurrence patch used a larger
  stale context block for the local-binary incident and was rejected
  atomically. Fresh numbered inspection confirmed no partial change, and the
  incident files are patched separately from their exact current lines. No
  source, provider, or private-data boundary was involved.
