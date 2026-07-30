# SB-20260728-005252-setback-index-context-stale: Setback index patch used stale timestamp context

- **Status:** closed
- **First observed:** 2026-07-28T00:52:52.8805934Z
- **Last observed:** 2026-07-30T19:52:45.8152645Z
- **Phase/task:** Calendar maintenance evidence Task 1 review fix reporting
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
- 2026-07-28T02:22:11.4959069Z: A combined documentation and setback update
  used stale index-row context and was rejected atomically. No source,
  provider, or private-data state changed; the source/reference correction and
  incident bookkeeping are split before retry.
- 2026-07-28T03:14:00Z: The ignored live report finalization patch used a
  stale summary line and was rejected atomically. Fresh report context and
  smaller section patches completed the safe report without touching tracked
  source or provider state.
- 2026-07-28T19:31:19Z: The ignored acceptance report append used a wrapped
  end-of-file anchor and was rejected atomically. Fresh tail inspection
  confirmed no partial report change; the append was retried against the exact
  final line. No source, provider, private-data, or controller-owned setback
  content was changed by the failed patch.
- 2026-07-30T19:52:45.8152645Z: A recurrence update for the line-ending
  incident assumed its header timestamp matched a newer recurrence already
  present in the file and index. The patch was rejected atomically. Exact
  header, tail, and index inspection confirmed no partial change; the retry
  uses each file's independently observed context.
